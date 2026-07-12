import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuthContext } from "@/lib/auth";

type Db = PrismaClient | Prisma.TransactionClient;

export type AuditEntry = {
  action: string; // "patient.create", "patient.read", "summary.finalize", ...
  resourceType: "Patient" | "DischargeSummary";
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

/** Fire-and-forget variant for read logging — must not fail the read itself. */
export function auditRead(auth: AuthContext, entry: AuditEntry) {
  audit(auth, entry).catch((err) => console.error("audit(read) failed", err));
}
