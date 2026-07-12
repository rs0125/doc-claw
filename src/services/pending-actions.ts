import { z } from "zod";
import type { AuthContext } from "@/lib/auth";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import {
  encounterCreateSchema,
  patientCreateSchema,
  patientUpdateSchema,
  prescriptionCreateSchema,
  summaryCreateSchema,
} from "@/lib/validation";
import { createEncounter } from "@/services/encounters";
import { createPatient, updatePatient } from "@/services/patients";
import { createPrescription } from "@/services/prescriptions";
import { createSummary, updateSummary } from "@/services/summaries";

const VIA = "telegram-agent";

function ttlMinutes(): number {
  const v = Number(process.env.PENDING_ACTION_TTL_MINUTES);
  return Number.isFinite(v) && v > 0 ? v : 15;
}

// Payload validators double as executors' input contract. Payloads are stored
// as the raw JSON the agent proposed and re-validated at execution time.
const actionSchemas = {
  "patient.create": z.object({ data: patientCreateSchema }),
  "patient.update": z.object({ patientId: z.string(), data: patientUpdateSchema }),
  "encounter.create": z.object({ patientId: z.string(), data: encounterCreateSchema }),
  "prescription.create": z.object({ patientId: z.string(), data: prescriptionCreateSchema }),
  "summary.create": z.object({ patientId: z.string(), data: summaryCreateSchema }),
  "summary.finalize": z.object({ summaryId: z.string() }),
} as const;

export type PendingActionType = keyof typeof actionSchemas;

export function isActionType(type: string): type is PendingActionType {
  return type in actionSchemas;
}

/** Validates the payload and stores the proposal. Nothing is written yet. */
export async function proposeAction(
  auth: AuthContext,
  type: PendingActionType,
  payload: unknown,
) {
  actionSchemas[type].parse(payload); // reject malformed proposals immediately
  return prisma.pendingAction.create({
    data: {
      doctorId: auth.doctor.id,
      type,
      payload: payload as object,
      expiresAt: new Date(Date.now() + ttlMinutes() * 60_000),
    },
  });
}

export async function listPendingActions(auth: AuthContext) {
  return prisma.pendingAction.findMany({
    where: { doctorId: auth.doctor.id, status: "PENDING", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Proposals that lapsed unconfirmed in the recent past. They are excluded from
 * listPendingActions (so they can't be confirmed), but the agent still needs to
 * know they existed so it can tell the doctor a change expired rather than
 * silently re-proposing.
 */
export async function listRecentlyExpiredActions(auth: AuthContext, sinceMinutes = 30) {
  const now = new Date();
  return prisma.pendingAction.findMany({
    where: {
      doctorId: auth.doctor.id,
      status: { in: ["PENDING", "EXPIRED"] },
      expiresAt: { lte: now, gt: new Date(now.getTime() - sinceMinutes * 60_000) },
      resolvedAt: null,
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Executes a proposed action. `confirmedAfter` is the timestamp of the
 * doctor's current message: an action proposed at-or-after that moment cannot
 * be confirmed in the same turn, so the model can never propose and
 * self-confirm without the doctor seeing the proposal first.
 */
export async function confirmAction(auth: AuthContext, actionId: string, confirmedAfter: Date) {
  const action = await prisma.pendingAction.findFirst({
    where: { id: actionId, doctorId: auth.doctor.id },
  });
  if (!action) throw new ApiError(404, "Pending action not found");
  if (action.status !== "PENDING") throw new ApiError(409, `Action is already ${action.status}`);
  if (action.expiresAt < new Date()) {
    await prisma.pendingAction.update({
      where: { id: action.id },
      data: { status: "EXPIRED", resolvedAt: new Date() },
    });
    throw new ApiError(410, "Action expired — propose it again");
  }
  if (action.createdAt >= confirmedAfter) {
    throw new ApiError(
      409,
      "This action was proposed in the current turn; the doctor must confirm it in their next message",
    );
  }

  const result = await executeAction(auth, action.type, action.payload);

  await prisma.pendingAction.update({
    where: { id: action.id },
    data: { status: "CONFIRMED", resolvedAt: new Date() },
  });

  return result;
}

export async function cancelAction(auth: AuthContext, actionId: string) {
  const action = await prisma.pendingAction.findFirst({
    where: { id: actionId, doctorId: auth.doctor.id },
  });
  if (!action) throw new ApiError(404, "Pending action not found");
  if (action.status !== "PENDING") throw new ApiError(409, `Action is already ${action.status}`);
  return prisma.pendingAction.update({
    where: { id: action.id },
    data: { status: "CANCELLED", resolvedAt: new Date() },
  });
}

async function executeAction(auth: AuthContext, type: string, payload: unknown) {
  if (!isActionType(type)) throw new ApiError(500, `Unknown action type ${type}`);
  switch (type) {
    case "patient.create": {
      const { data } = actionSchemas[type].parse(payload);
      return { patient: await createPatient(auth, data, VIA) };
    }
    case "patient.update": {
      const { patientId, data } = actionSchemas[type].parse(payload);
      return { patient: await updatePatient(auth, patientId, data, VIA) };
    }
    case "encounter.create": {
      const { patientId, data } = actionSchemas[type].parse(payload);
      return { encounter: await createEncounter(auth, patientId, data, VIA) };
    }
    case "prescription.create": {
      const { patientId, data } = actionSchemas[type].parse(payload);
      return { prescription: await createPrescription(auth, patientId, data, VIA) };
    }
    case "summary.create": {
      const { patientId, data } = actionSchemas[type].parse(payload);
      return { summary: await createSummary(auth, patientId, data, VIA) };
    }
    case "summary.finalize": {
      const { summaryId } = actionSchemas[type].parse(payload);
      return { summary: await updateSummary(auth, summaryId, { status: "FINAL" }, VIA) };
    }
  }
}
