import { createHash, randomBytes } from "crypto";
import type { Doctor } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/http";

export type AuthContext = {
  doctor: Doctor;
  tokenId: string | null; // null when acting via the in-process agent, not an API token
};

/** Auth context for the Telegram agent acting on a linked doctor's behalf. */
export function agentAuth(doctor: Doctor): AuthContext {
  return { doctor, tokenId: null };
}

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/** Generates a raw API token. Only the sha256 hash is ever persisted. */
export function generateToken(): { raw: string; hash: string } {
  const raw = `dct_${randomBytes(24).toString("hex")}`;
  return { raw, hash: hashToken(raw) };
}

/**
 * Resolves `Authorization: Bearer <token>` to a doctor.
 * Every route handler goes through this; all queries downstream
 * must be scoped by the returned doctor's id.
 */
export async function authenticate(req: Request): Promise<AuthContext> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new ApiError(401, "Missing bearer token");
  }
  const raw = header.slice("Bearer ".length).trim();

  const token = await prisma.apiToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { doctor: true },
  });

  if (!token || token.revokedAt) {
    throw new ApiError(401, "Invalid or revoked token");
  }

  // Best-effort usage tracking; never blocks the request.
  prisma.apiToken
    .update({ where: { id: token.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { doctor: token.doctor, tokenId: token.id };
}
