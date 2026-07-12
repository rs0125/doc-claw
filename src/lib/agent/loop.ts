import OpenAI from "openai";
import type { Doctor } from "@/generated/prisma/client";
import { agentAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { agentTools, executeTool } from "@/lib/agent/tools";
import { listPendingActions } from "@/services/pending-actions";

const MAX_TOOL_ROUNDS = 8;
const HISTORY_MESSAGES = 20;

let openai: OpenAI | undefined;
function client(): OpenAI {
  openai ??= new OpenAI(); // reads OPENAI_API_KEY
  return openai;
}

function systemPrompt(doctor: Doctor, pending: { id: string; type: string }[]): string {
  return [
    `You are a patient-records assistant for ${doctor.name}, a doctor in India, chatting over Telegram.`,
    `Today's date is ${new Date().toISOString().slice(0, 10)}.`,
    "",
    "Rules:",
    "- You only have access to this doctor's own patients. Never speculate about records you have not fetched with a tool.",
    "- Any write (creating or updating anything) MUST go through propose_action first. After proposing, repeat back EXACTLY what will be saved — every field, every dose — and ask the doctor to confirm.",
    "- Only call confirm_action after the doctor explicitly says yes IN A MESSAGE SENT AFTER you showed them the proposal. Never propose and confirm in the same turn; the server will reject it.",
    "- Medication details are safety-critical. Quote doses and frequencies verbatim; if anything is ambiguous (drug name, dose, patient identity), ask instead of guessing.",
    "- If several patients match a name, list them and ask which one — never assume.",
    "- PDF links expire in 15 minutes; mention that when sharing one.",
    "- Reply in plain text (no markdown). Be brief and precise, like a good ward assistant.",
    "- You are not a diagnostic tool. If asked for clinical judgement beyond the records, say the records are all you can speak to.",
    pending.length > 0
      ? `\nPending unconfirmed actions: ${pending.map((p) => `${p.id} (${p.type})`).join(", ")}. If the doctor's message confirms one of these, call confirm_action with its id; if they reject it, cancel_action.`
      : "",
  ].join("\n");
}

/**
 * One conversational turn: takes the doctor's message (already persisted),
 * runs the tool loop, persists and returns the assistant's reply.
 */
export async function runAgentTurn(doctor: Doctor, userMessageAt: Date): Promise<string> {
  const auth = agentAuth(doctor);

  const [history, pending] = await Promise.all([
    prisma.conversationMessage.findMany({
      where: { doctorId: doctor.id },
      orderBy: { createdAt: "desc" },
      take: HISTORY_MESSAGES,
    }),
    listPendingActions(auth),
  ]);

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt(doctor, pending) },
    // history is newest-first and already includes the current user message
    ...history.reverse().map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  let reply = "Sorry, I could not process that. Please try again.";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const completion = await client().chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
      messages,
      tools: agentTools,
    });

    const choice = completion.choices[0].message;
    messages.push(choice);

    if (!choice.tool_calls?.length) {
      reply = choice.content?.trim() || reply;
      break;
    }

    for (const call of choice.tool_calls) {
      if (call.type !== "function") continue;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        // leave args empty; the executor will report the problem
      }
      const result = await executeTool(
        { auth, userMessageAt },
        call.function.name,
        args,
      );
      messages.push({ role: "tool", tool_call_id: call.id, content: result });
    }
  }

  await prisma.conversationMessage.create({
    data: { doctorId: doctor.id, role: "assistant", content: reply },
  });

  return reply;
}
