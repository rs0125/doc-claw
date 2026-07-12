import type OpenAI from "openai";
import type { AuthContext } from "@/lib/auth";
import { ApiError } from "@/lib/http";
import { listEncounters } from "@/services/encounters";
import { getPatient, searchPatients } from "@/services/patients";
import { getPrescriptionDocumentUrl, listPrescriptions } from "@/services/prescriptions";
import {
  cancelAction,
  confirmAction,
  isActionType,
  proposeAction,
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

const patientFieldsParam = {
  type: "object",
  properties: {
    name: { type: "string" },
    dateOfBirth: { type: "string", description: "YYYY-MM-DD" },
    sex: { type: "string", enum: ["MALE", "FEMALE", "OTHER", "UNKNOWN"] },
    phone: { type: "string" },
    abhaId: { type: "string" },
    bloodGroup: { type: "string" },
    allergies: { type: "array", items: { type: "string" } },
    chronicConditions: { type: "array", items: { type: "string" } },
    currentMedications: { type: "array", items: medicationParam },
    notes: { type: "string" },
  },
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
  tool(
    "propose_action",
    "Propose a write (create/update). Nothing is saved until the doctor confirms in their NEXT message. " +
      "type is one of: patient.create, patient.update, encounter.create, prescription.create, summary.create, summary.finalize. " +
      "payload shapes: patient.create {data: patientFields}; patient.update {patientId, data: patientFields}; " +
      "encounter.create {patientId, data: {date, complaint, examination?, vitals?, diagnosis?, plan?, notes?}}; " +
      "prescription.create {patientId, data: {date, medications: [medication], advice?, followUpDate?, encounterId?}}; " +
      "summary.create {patientId, data: {admissionDate, dischargeDate, diagnosis, hospitalCourse, presentingComplaint?, investigations?, treatmentGiven?, conditionAtDischarge?, medicationsAtDischarge?, followUpInstructions?}}; " +
      "summary.finalize {summaryId}. Dates are YYYY-MM-DD. Medication: {name, dose, frequency, duration?, notes?}. " +
      "patientFields: " + JSON.stringify(patientFieldsParam.properties),
    {
      type: { type: "string" },
      payload: { type: "object", description: "Payload matching the shape for the given type" },
    },
    ["type", "payload"],
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
    console.error(`tool ${name} failed`, err);
    return JSON.stringify({ error: "Tool failed unexpectedly" });
  }
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
    case "propose_action": {
      const type = args.type as string;
      if (!isActionType(type)) return { error: `Unknown action type ${type}` };
      const action = await proposeAction(auth, type, args.payload);
      return {
        actionId: action.id,
        status: "PENDING",
        expiresAt: action.expiresAt,
        note: "Show the doctor exactly what will be saved and ask them to confirm.",
      };
    }
    case "confirm_action":
      return confirmAction(auth, args.actionId as string, ctx.userMessageAt);
    case "cancel_action":
      return cancelAction(auth, args.actionId as string);
    default:
      return { error: `Unknown tool ${name}` };
  }
}
