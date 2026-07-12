"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionDoctor, revokeCurrentSession, SESSION_COOKIE } from "@/lib/web-auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

export type AccountState = { error?: string; ok?: string };

export async function changePasswordAction(
  _prev: AccountState,
  fd: FormData,
): Promise<AccountState> {
  const doctor = await getSessionDoctor();
  if (!doctor) redirect("/login");

  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  const confirm = String(fd.get("confirm") ?? "");

  if (next.length < 8) return { error: "New password must be at least 8 characters." };
  if (next !== confirm) return { error: "New passwords don't match." };

  // If a password is already set, require the current one.
  if (doctor.passwordHash && !(await verifyPassword(current, doctor.passwordHash))) {
    return { error: "Current password is incorrect." };
  }

  await prisma.doctor.update({
    where: { id: doctor.id },
    data: { passwordHash: await hashPassword(next) },
  });
  return { ok: "Password updated." };
}

/** Revoke every web session for this doctor and sign out here. */
export async function signOutAllAction() {
  const doctor = await getSessionDoctor();
  if (!doctor) redirect("/login");
  await prisma.webSession.updateMany({
    where: { doctorId: doctor.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await revokeCurrentSession();
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
