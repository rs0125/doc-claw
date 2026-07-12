"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/web-auth";

export type LoginState = { error?: string };

export async function passwordLoginAction(
  _prev: LoginState,
  fd: FormData,
): Promise<LoginState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  // Throttle brute force: by IP and by email.
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  try {
    await rateLimit(`login:ip:${ip}`, { limit: 10, windowSec: 300 });
    await rateLimit(`login:email:${email}`, { limit: 5, windowSec: 300 });
  } catch (err) {
    if (err instanceof ApiError && err.status === 429) {
      return { error: "Too many attempts. Please wait a few minutes and try again." };
    }
    throw err;
  }

  const doctor = await prisma.doctor.findUnique({ where: { email } });
  // Verify even when the doctor is missing to keep timing uniform.
  const ok = await verifyPassword(password, doctor?.passwordHash ?? null);
  if (!doctor || !ok) return { error: "Invalid email or password." };

  const raw = await createSession(doctor.id);
  (await cookies()).set(SESSION_COOKIE, raw, sessionCookieOptions);
  redirect("/dashboard");
}
