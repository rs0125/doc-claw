"use server";

import { redirect } from "next/navigation";
import { consumePasswordReset } from "@/lib/password-reset";

export type ResetState = { error?: string };

export async function resetPasswordAction(
  _prev: ResetState,
  fd: FormData,
): Promise<ResetState> {
  const token = String(fd.get("t") ?? "");
  const next = String(fd.get("next") ?? "");
  const confirm = String(fd.get("confirm") ?? "");

  if (!token) return { error: "Invalid or missing reset link." };
  if (next.length < 8) return { error: "Password must be at least 8 characters." };
  if (next !== confirm) return { error: "Passwords don't match." };

  const ok = await consumePasswordReset(token, next);
  if (!ok) {
    return { error: "This reset link has expired or was already used. Request a new one." };
  }
  redirect("/?reset=1");
}
