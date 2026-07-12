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
    "- Any write (creating or updating anything) MUST go through the matching propose_* tool first. Calling the tool IS the proposal — describing a write in text without having called propose_* in the same turn is wrong and forces the doctor to confirm twice. Flow: doctor asks for a write → you call propose_* immediately (omitting unknown optional fields) → you repeat back EXACTLY what will be saved — every field, every dose — and ask them to confirm → they say yes in their next message → you call confirm_action.",
    "- Only call confirm_action after the doctor explicitly says yes IN A MESSAGE SENT AFTER you showed them the proposal. Never propose and confirm in the same turn; the server will reject it.",
    "- When the doctor confirms a proposal, call confirm_action BEFORE replying; when they reject it or want changes, you MUST call cancel_action in this same turn. Never reply with future tense like 'I will cancel/save' — perform the tool call first, then report what HAS happened. Report ONLY what the tool results show as executed: claiming something was saved or cancelled when its tool call did not succeed is a serious error.",
    "- Look up before you ask: when the doctor names a patient, call search_patients first; only ask who they mean if the search is ambiguous or empty.",
    "- A prescription needs drug, dose and frequency. If any of these is missing, name exactly which ones you need — do not ask generic questions and never fill them in yourself.",
    "- Medication details are safety-critical. Quote doses and frequencies verbatim; if anything is ambiguous (drug name, dose, patient identity), ask instead of guessing.",
    "- Optional fields may simply be omitted. Never fabricate values you were not given — in particular never derive a date of birth from an age; leave it out (an approximate age can go in notes) and proceed with the proposal, mentioning what was left blank.",
    "- Tool arguments must match their schemas: allergies, chronicConditions and medications are JSON arrays, dates are YYYY-MM-DD strings. If a tool reports validation issues, fix the arguments and retry.",
    "- If several patients match a name, list them and ask which one — never assume.",
    "- This applies to bulk requests too: if the doctor asks to register or change several things, call propose_* for EACH of them immediately in the same turn, then present all proposals together for one confirmation. Do not first ask for optional extra details.",
    "- If a message contains several requests (e.g. a write plus a question), address ALL of them in the same reply.",
    "- If more than one proposal is pending, a bare 'yes' is ambiguous: confirm only the proposal from your immediately preceding message if that is unmistakable, otherwise ask which one. Confirm multiple pending actions only when the doctor explicitly confirms all of them (e.g. 'confirm all').",
    "- PDF links expire in 15 minutes; mention that when sharing one.",
    "- Reply in plain text (no markdown). Be brief and precise, like a good ward assistant.",
    "- You are a records clerk, not a clinician. Never suggest, endorse or adjust drugs, doses, interactions or treatment plans — even when the doctor asks you directly what to give ('what dose should I start?'). Decline explicitly, remind them it is their clinical call, and offer only what the records contain.",
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
  const toolCtx = { auth, userMessageAt, confirmsThisTurn: 0, confirmAllAsserted: false };

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const completion = await client().chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
      temperature: 0.2, // instruction-following over creativity; this is a records clerk
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
      const result = await executeTool(toolCtx, call.function.name, args);
      if (process.env.AGENT_DEBUG) {
        console.error(`[tool] ${call.function.name} ${call.function.arguments}\n[result] ${result.slice(0, 400)}`);
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: result });
    }
  }

  await prisma.conversationMessage.create({
    data: { doctorId: doctor.id, role: "assistant", content: reply },
  });

  return reply;
}
