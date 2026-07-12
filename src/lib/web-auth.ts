import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import type { Doctor } from "@/generated/prisma/client";
import type { AuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "kordex_session";
const LOGIN_TOKEN_TTL_MIN = 10;
const SESSION_TTL_HOURS = 24;

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** Mint a one-time login token for a doctor; returns the raw token for the link. */
export async function createLoginToken(doctorId: string): Promise<string> {
  const raw = randomBytes(24).toString("hex");
  await prisma.loginToken.create({
    data: {
      doctorId,
      tokenHash: sha256(raw),
      expiresAt: new Date(Date.now() + LOGIN_TOKEN_TTL_MIN * 60_000),
    },
  });
  return raw;
}

/** Create a session for a doctor; returns the raw session id for the cookie. */
export async function createSession(doctorId: string): Promise<string> {
  const rawSession = randomBytes(32).toString("hex");
  await prisma.webSession.create({
    data: {
      doctorId,
      sessionHash: sha256(rawSession),
      expiresAt: new Date(Date.now() + SESSION_TTL_HOURS * 3600_000),
    },
  });
  return rawSession;
}

/**
 * Exchange a raw login token for a new session. Single-use and time-bounded:
 * marks the token used inside the same transaction so a link can't be replayed.
 * Returns the raw session id to set as a cookie, or null if invalid/expired/used.
 */
export async function redeemLoginToken(rawToken: string): Promise<string | null> {
  const token = await prisma.loginToken.findUnique({ where: { tokenHash: sha256(rawToken) } });
  if (!token || token.usedAt || token.expiresAt < new Date()) return null;

  const rawSession = randomBytes(32).toString("hex");
  try {
    await prisma.$transaction(async (tx) => {
      // Consume the token atomically; updateMany with a usedAt=null guard makes
      // a concurrent double-redeem impossible.
      const claimed = await tx.loginToken.updateMany({
        where: { id: token.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) throw new Error("token already used");
      await tx.webSession.create({
        data: {
          doctorId: token.doctorId,
          sessionHash: sha256(rawSession),
          expiresAt: new Date(Date.now() + SESSION_TTL_HOURS * 3600_000),
        },
      });
    });
  } catch {
    return null;
  }
  return rawSession;
}

/** Resolve the session cookie to a doctor, or null. */
export async function getSessionDoctor(): Promise<Doctor | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const session = await prisma.webSession.findUnique({
    where: { sessionHash: sha256(raw) },
    include: { doctor: true },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  return session.doctor;
}

/** AuthContext for the web GUI (no API token; audited as via:"web"). */
export function webAuth(doctor: Doctor): AuthContext {
  return { doctor, tokenId: null };
}

/** Revoke the current session (logout). */
export async function revokeCurrentSession(): Promise<void> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return;
  await prisma.webSession
    .updateMany({ where: { sessionHash: sha256(raw) }, data: { revokedAt: new Date() } })
    .catch(() => {});
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_HOURS * 3600,
};
