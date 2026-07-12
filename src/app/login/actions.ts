"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/web-auth";

export type LoginState = { error?: string };

export async function passwordLoginAction(
  _prev: LoginState,
  fd: FormData,
): Promise<LoginState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const doctor = await prisma.doctor.findUnique({ where: { email } });
  // Verify even when the doctor is missing to keep timing uniform.
  const ok = await verifyPassword(password, doctor?.passwordHash ?? null);
  if (!doctor || !ok) return { error: "Invalid email or password." };

  const raw = await createSession(doctor.id);
  (await cookies()).set(SESSION_COOKIE, raw, sessionCookieOptions);
  redirect("/dashboard");
}
