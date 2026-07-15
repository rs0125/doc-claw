import type OpenAI from "openai";
import { ZodError } from "zod";
import type { AuthContext } from "@/lib/auth";
import { ApiError } from "@/lib/http";
import { listEncounters } from "@/services/encounters";
import { getAttachmentUrl, listAttachments } from "@/services/attachments";
import { getPatient, searchPatients } from "@/services/patients";
import { getPrescriptionDocumentUrl, listPrescriptions } from "@/services/prescriptions";
import { sendDocument, sendPhoto } from "@/lib/telegram";
import {
  cancelAction,
  confirmAction,
  listPendingActions,
  proposeAction,
  type PendingActionType,
} from "@/services/pending-actions";
import { getSurgery, getSurgeryDocumentUrl, listSurgeries } from "@/services/surgeries";

const medicationParam = {
  type: "object",
  properties: {
    name: { type: "string" },
    dose: { type: "string", description: 'e.g. "500 mg"' },
    frequency: { type: "string", description: 'e.g. "1-0-1" or "twice daily"' },
    duration: { type: "string" },
    notes: { type: "string" },
  },
  required: ["name", "dose", "frequency"],
} as const;

const patientFields = {
  name: { type: "string" },
  dateOfBirth: { type: "string", description: "YYYY-MM-DD; use only if the exact date is known" },
  age: {
    type: "integer",
    description: "Patient's age in years; use this when only age is known (not the birth date)",
  },
  sex: { type: "string", enum: ["MALE", "FEMALE", "OTHER", "UNKNOWN"] },
  phone: { type: "string" },
  abhaId: { type: "string" },
  bloodGroup: { type: "string" },
  allergies: { type: "array", items: { type: "string" } },
  chronicConditions: { type: "array", items: { type: "string" } },
  currentMedications: { type: "array", items: medicationParam },
  notes: { type: "string" },
} as const;

function tool(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[] = [],
): OpenAI.Chat.Completions.ChatCompletionTool {
  return {
    type: "function",
    function: {
      name,
      description,
      parameters: { type: "object", properties, required },
    },
  };
}

const PROPOSE_NOTE =
  "Nothing is saved yet: show the doctor exactly what will be saved and ask them to confirm.";

export const agentTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  tool(
    "search_patients",
    "Search the doctor's patients by name or phone. Empty query lists recent patients.",
    { q: { type: "string" } },
  ),
  tool("get_patient", "Fetch a patient's full record.", { patientId: { type: "string" } }, [
    "patientId",
  ]),
  tool("list_encounters", "List a patient's visits/encounters, newest first.", {
    patientId: { type: "string" },
  }, ["patientId"]),
  tool("list_prescriptions", "List a patient's prescriptions, newest first.", {
    patientId: { type: "string" },
  }, ["patientId"]),
  tool("list_surgeries", "List a patient's surgeries, newest first.", {
    patientId: { type: "string" },
  }, ["patientId"]),
  tool("get_surgery", "Fetch one surgery in full.", {
    surgeryId: { type: "string" },
  }, ["surgeryId"]),
  tool(
    "get_surgery_pdf",
    "Get a download link (valid 15 min) for a surgery PDF.",
    { surgeryId: { type: "string" } },
    ["surgeryId"],
  ),
  tool(
    "get_prescription_pdf",
    "Get a download link (valid 15 min) for a prescription PDF.",
    { prescriptionId: { type: "string" } },
    ["prescriptionId"],
  ),
  tool(
    "list_attachments",
    "List a patient's uploaded photos/scans (paper prescriptions, lab reports). Optional kind filter.",
    {
      patientId: { type: "string" },
      kind: { type: "string", enum: ["PRESCRIPTION", "SURGERY", "LAB_REPORT", "OTHER"] },
    },
    ["patientId"],
  ),
  tool(
    "send_attachment",
    "Send a stored photo/scan to the doctor in this chat. Use an attachmentId from list_attachments.",
    { attachmentId: { type: "string" } },
    ["attachmentId"],
  ),

  // Write proposals — executed only after the doctor confirms in a later message.
  tool(
    "propose_create_patient",
    `Propose registering a new patient. ${PROPOSE_NOTE}`,
    patientFields,
    ["name"],
  ),
  tool(
    "propose_update_patient",
    `Propose updating an existing patient; include only the fields to change. ${PROPOSE_NOTE}`,
    { patientId: { type: "string" }, ...patientFields },
    ["patientId"],
  ),
  tool(
    "propose_record_encounter",
    `Propose recording a visit/encounter. ${PROPOSE_NOTE}`,
    {
      patientId: { type: "string" },
      date: { type: "string", description: "YYYY-MM-DD" },
      complaint: { type: "string" },
      examination: { type: "string" },
      vitals: {
        type: "object",
        description: 'e.g. {"bp": "130/85", "pulse": 78}',
        additionalProperties: { type: ["string", "number"] },
      },
      diagnosis: { type: "string" },
      plan: { type: "string" },
      notes: { type: "string" },
    },
    ["patientId", "date", "complaint"],
  ),
  tool(
    "propose_create_prescription",
    `Propose a prescription. Every medication needs name, dose and frequency — ask the doctor rather than inventing any of them. ${PROPOSE_NOTE}`,
    {
      patientId: { type: "string" },
      date: { type: "string", description: "YYYY-MM-DD" },
      medications: { type: "array", items: medicationParam },
      advice: { type: "string" },
      followUpDate: { type: "string", description: "YYYY-MM-DD" },
      encounterId: { type: "string" },
    },
    ["patientId", "date", "medications"],
  ),
  tool(
    "propose_create_surgery",
    `Propose a surgery record. ${PROPOSE_NOTE}`,
    {
      patientId: { type: "string" },
      admissionDate: { type: "string", description: "YYYY-MM-DD" },
      dischargeDate: { type: "string", description: "YYYY-MM-DD" },
      diagnosis: { type: "string" },
      presentingComplaint: { type: "string" },
      hospitalCourse: { type: "string" },
      investigations: { type: "string" },
      treatmentGiven: { type: "string" },
      conditionAtDischarge: { type: "string" },
      medicationsAtDischarge: { type: "array", items: medicationParam },
      followUpInstructions: { type: "string" },
    },
    ["patientId", "admissionDate", "dischargeDate", "diagnosis", "hospitalCourse"],
  ),
  tool(
    "confirm_action",
    "Execute a previously proposed action. Call ONLY after the doctor has explicitly confirmed it in a message sent AFTER the proposal was shown to them. Only one action may be confirmed per doctor message — unless the doctor explicitly confirmed ALL pending proposals (e.g. 'confirm all'), in which case set confirmAll: true on every call.",
    {
      actionId: { type: "string" },
      confirmAll: {
        type: "boolean",
        description:
          "Set true ONLY when the doctor's exact words confirm ALL pending proposals ('confirm all', 'yes to all three'). NEVER set it for a bare 'yes'. This flag does NOT execute other actions — each action still needs its own confirm_action call.",
      },
    },
    ["actionId"],
  ),
  tool("cancel_action", "Cancel a proposed action the doctor rejected.", {
    actionId: { type: "string" },
  }, ["actionId"]),
];

export type ToolContext = {
  auth: AuthContext;
  /** Timestamp of the doctor's current message — the confirm-gating anchor. */
  userMessageAt: Date;
  /** Telegram chat to send media to (absent outside the bot, e.g. REPL/eval). */
  chatId?: string;
  /** Mutable per-turn counter enforcing one confirmation per doctor message. */
  confirmsThisTurn: number;
  /** Set once the model asserts the doctor confirmed ALL pending proposals. */
  confirmAllAsserted: boolean;
  /** Whether the doctor's message actually authorizes confirming ALL (contains "all"/"both"/…). */
  confirmAllAllowed: boolean;
};

export async function executeTool(
  ctx: ToolContext,
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  try {
    const result = await run(ctx, name, args);
    return JSON.stringify(result);
  } catch (err) {
    if (err instanceof ApiError) return JSON.stringify({ error: err.message });
    if (err instanceof ZodError) {
      // Feed the exact validation problems back so the model can fix its call.
      return JSON.stringify({
        error: "Invalid arguments",
        issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    console.error(`tool ${name} failed`, err);
    return JSON.stringify({ error: "Tool failed unexpectedly" });
  }
}

async function propose(auth: AuthContext, type: PendingActionType, payload: unknown) {
  const { action, status } = await proposeAction(auth, type, payload);
  if (status === "already_saved") {
    return {
      actionId: action.id,
      status: "ALREADY_SAVED",
      note: "An identical change was ALREADY saved. Do not propose or confirm again — just tell the doctor it is already saved.",
    };
  }
  if (status === "duplicate_pending") {
    return {
      actionId: action.id,
      status: "PENDING",
      note: `Identical to a proposal already awaiting confirmation (${action.id}). Do NOT re-propose. If the doctor approved it, call confirm_action('${action.id}'); if they asked whether it saved, tell them it is NOT yet saved and ask them to confirm.`,
    };
  }
  return { actionId: action.id, status: "PENDING", expiresAt: action.expiresAt, note: PROPOSE_NOTE };
}

async function run(ctx: ToolContext, name: string, args: Record<string, unknown>) {
  const { auth } = ctx;
  switch (name) {
    case "search_patients":
      return searchPatients(auth, { q: args.q as string | undefined, limit: 10, offset: 0 });
    case "get_patient":
      return getPatient(auth, args.patientId as string);
    case "list_encounters":
      return listEncounters(auth, args.patientId as string);
    case "list_prescriptions":
      return listPrescriptions(auth, args.patientId as string);
    case "list_surgeries":
      return listSurgeries(auth, args.patientId as string);
    case "get_surgery":
      return getSurgery(auth, args.surgeryId as string);
    case "get_surgery_pdf":
      return getSurgeryDocumentUrl(auth, args.surgeryId as string);
    case "get_prescription_pdf":
      return getPrescriptionDocumentUrl(auth, args.prescriptionId as string);
    case "list_attachments": {
      const items = await listAttachments(
        auth,
        args.patientId as string,
        args.kind as never,
      );
      return items.map((a) => ({
        attachmentId: a.id,
        kind: a.kind,
        fileName: a.fileName,
        uploadedAt: a.createdAt,
      }));
    }
    case "send_attachment": {
      if (!ctx.chatId) {
        return { error: "Sending files is only available in the Telegram chat." };
      }
      const { url, attachment } = await getAttachmentUrl(auth, args.attachmentId as string);
      const caption = attachment.fileName ?? attachment.kind;
      if (attachment.contentType.startsWith("image/")) {
        await sendPhoto(ctx.chatId, url, caption);
      } else {
        await sendDocument(ctx.chatId, url, caption);
      }
      return { sent: true, note: "The file has been sent to the chat." };
    }

    case "propose_create_patient":
      return propose(auth, "patient.create", { data: args });
    case "propose_update_patient": {
      const { patientId, ...data } = args;
      return propose(auth, "patient.update", { patientId, data });
    }
    case "propose_record_encounter": {
      const { patientId, ...data } = args;
      return propose(auth, "encounter.create", { patientId, data });
    }
    case "propose_create_prescription": {
      const { patientId, ...data } = args;
      return propose(auth, "prescription.create", { patientId, data });
    }
    case "propose_create_surgery": {
      const { patientId, ...data } = args;
      return propose(auth, "surgery.create", { patientId, data });
    }
    case "confirm_action": {
      // Only honor confirmAll if the doctor's actual words authorize it; the
      // model must not turn a bare "yes" into a confirm-everything.
      const confirmAll = args.confirmAll === true && ctx.confirmAllAllowed;

      if (confirmAll) {
        // Execute the named action AND every other pending one, in one shot, so
        // "confirm all" is deterministic regardless of how many confirm_action
        // calls the model makes.
        const executed: unknown[] = [];
        const seen = new Set<string>();
        const primary = await confirmAction(auth, args.actionId as string, ctx.userMessageAt);
        executed.push(primary);
        seen.add(args.actionId as string);
        for (const a of await listPendingActions(auth)) {
          if (seen.has(a.id)) continue;
          try {
            executed.push(await confirmAction(auth, a.id, ctx.userMessageAt));
            seen.add(a.id);
          } catch {
            // skip anything that can't be confirmed (expired/raced)
          }
        }
        ctx.confirmsThisTurn += executed.length;
        ctx.confirmAllAsserted = true;
        return { executed, count: executed.length, note: `Confirmed and saved ${executed.length} pending action(s).` };
      }

      if (ctx.confirmsThisTurn >= 1) {
        return {
          error:
            "One action was already confirmed for this message. A single 'yes' confirms one proposal only — ask the doctor about the remaining proposals, or set confirmAll: true if their message explicitly confirmed all of them.",
        };
      }
      const result = await confirmAction(auth, args.actionId as string, ctx.userMessageAt);
      ctx.confirmsThisTurn += 1;
      const stillPending = await listPendingActions(auth);
      return {
        executed: result,
        stillPendingActions: stillPending.map((a) => ({ actionId: a.id, type: a.type })),
        note:
          stillPending.length > 0
            ? "ONLY the action above was executed. The listed actions are still pending and NOT saved — confirm each separately if (and only if) the doctor confirmed them, otherwise tell the doctor they remain unconfirmed."
            : "This action was executed. No other proposals are pending.",
      };
    }
    case "cancel_action":
      return cancelAction(auth, args.actionId as string);
    default:
      return { error: `Unknown tool ${name}` };
  }
}
