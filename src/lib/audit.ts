import { after } from "next/server";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuthContext } from "@/lib/auth";

/**
 * Runs non-blocking work that must still complete on serverless. A bare
 * floating promise is frozen (often dropped) the moment the response is sent
 * on Vercel; after() keeps the instance alive until the task finishes.
 * Falls back to fire-and-forget outside a request scope (CLI, tests).
 */
export function deferred(task: () => Promise<unknown>) {
  try {
    after(task);
  } catch {
    void task();
  }
}

type Db = PrismaClient | Prisma.TransactionClient;

export type AuditEntry = {
  action: string; // "patient.create", "patient.read", "surgery.finalize", ...
  resourceType: "Patient" | "Surgery" | "Encounter" | "Prescription" | "Attachment";
  resourceId?: string;
  details?: Prisma.InputJsonValue;
};

/**
 * Writes an audit row. Pass the transaction client from write operations
 * so the audit entry is atomic with the change it records.
 */
export async function audit(auth: AuthContext, entry: AuditEntry, db: Db = prisma) {
  await db.auditLog.create({
    data: {
      doctorId: auth.doctor.id,
      tokenId: auth.tokenId,
      ...entry,
    },
  });
}

/** Non-blocking variant for read logging — must not fail the read itself. */
export function auditRead(auth: AuthContext, entry: AuditEntry) {
  deferred(() => audit(auth, entry).catch((err) => console.error("audit(read) failed", err)));
}

/** The doctor's own recent activity, newest first. */
export function listAuditLogs(auth: AuthContext, limit = 100) {
  return prisma.auditLog.findMany({
    where: { doctorId: auth.doctor.id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
