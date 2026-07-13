import { createHash, randomBytes } from "crypto";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const RESET_TTL_MIN = 15;

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** Mint a one-time reset token for a doctor; returns the raw token for the link. */
export async function createPasswordResetToken(doctorId: string): Promise<string> {
  const raw = randomBytes(24).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      doctorId,
      tokenHash: sha256(raw),
      expiresAt: new Date(Date.now() + RESET_TTL_MIN * 60_000),
    },
  });
  return raw;
}

/** Read-only validity check (does NOT consume) — used to render the reset form. */
export async function isResetTokenValid(rawToken: string): Promise<boolean> {
  if (!rawToken) return false;
  const t = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(rawToken) } });
  return !!t && !t.usedAt && t.expiresAt > new Date();
}

/**
 * Consume the token and set the new password, atomically. Also revokes all
 * existing web sessions (a reset should sign out every device). Returns true on
 * success, false if the token was invalid/expired/already used.
 */
export async function consumePasswordReset(rawToken: string, newPassword: string): Promise<boolean> {
  const token = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: sha256(rawToken) },
  });
  if (!token || token.usedAt || token.expiresAt < new Date()) return false;

  const passwordHash = await hashPassword(newPassword);
  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: token.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) throw new Error("token already used");
      await tx.doctor.update({ where: { id: token.doctorId }, data: { passwordHash } });
      await tx.webSession.updateMany({
        where: { doctorId: token.doctorId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  } catch {
    return false;
  }
  return true;
}
