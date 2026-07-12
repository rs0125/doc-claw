import type OpenAI from "openai";
import { ZodError } from "zod";
import type { AuthContext } from "@/lib/auth";
import { ApiError } from "@/lib/http";
import { listEncounters } from "@/services/encounters";
import { getPatient, searchPatients } from "@/services/patients";
import { getPrescriptionDocumentUrl, listPrescriptions } from "@/services/prescriptions";
import {
  cancelAction,
  confirmAction,
  proposeAction,
  type PendingActionType,
} from "@/services/pending-actions";
import { getSummary, getSummaryDocumentUrl, listSummaries } from "@/services/summaries";

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
  dateOfBirth: { type: "string", description: "YYYY-MM-DD; omit if unknown" },
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
  tool("list_discharge_summaries", "List a patient's discharge summaries, newest first.", {
    patientId: { type: "string" },
  }, ["patientId"]),
  tool("get_discharge_summary", "Fetch one discharge summary in full.", {
    summaryId: { type: "string" },
  }, ["summaryId"]),
  tool(
    "get_discharge_summary_pdf",
    "Get a download link (valid 15 min) for a discharge summary PDF.",
    { summaryId: { type: "string" } },
    ["summaryId"],
  ),
  tool(
    "get_prescription_pdf",
    "Get a download link (valid 15 min) for a prescription PDF.",
    { prescriptionId: { type: "string" } },
    ["prescriptionId"],
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
    "propose_create_discharge_summary",
    `Propose a discharge summary (created as DRAFT). ${PROPOSE_NOTE}`,
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
    "propose_finalize_discharge_summary",
    `Propose finalizing a discharge summary — it becomes immutable. ${PROPOSE_NOTE}`,
    { summaryId: { type: "string" } },
    ["summaryId"],
  ),
  tool(
    "confirm_action",
    "Execute a previously proposed action. Call ONLY after the doctor has explicitly confirmed it in a message sent AFTER the proposal was shown to them.",
    { actionId: { type: "string" } },
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
  const action = await proposeAction(auth, type, payload);
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
    case "list_discharge_summaries":
      return listSummaries(auth, args.patientId as string);
    case "get_discharge_summary":
      return getSummary(auth, args.summaryId as string);
    case "get_discharge_summary_pdf":
      return getSummaryDocumentUrl(auth, args.summaryId as string);
    case "get_prescription_pdf":
      return getPrescriptionDocumentUrl(auth, args.prescriptionId as string);

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
    case "propose_create_discharge_summary": {
      const { patientId, ...data } = args;
      return propose(auth, "summary.create", { patientId, data });
    }
    case "propose_finalize_discharge_summary":
      return propose(auth, "summary.finalize", { summaryId: args.summaryId });

    case "confirm_action":
      return confirmAction(auth, args.actionId as string, ctx.userMessageAt);
    case "cancel_action":
      return cancelAction(auth, args.actionId as string);
    default:
      return { error: `Unknown tool ${name}` };
  }
}
