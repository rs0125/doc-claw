"use server";

import { headers } from "next/headers";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { createPasswordResetToken } from "@/lib/password-reset";
import { sendMessage } from "@/lib/telegram";

export type ForgotState = { error?: string; done?: boolean };

function appBaseUrl(): string {
  return (process.env.APP_BASE_URL ?? "https://doc-claw.vercel.app").replace(/\/$/, "");
}

/**
 * Sends a password-reset link to the doctor's linked Telegram chat.
 *
 * Delivery is Telegram-only (no email/domain), so a doctor whose Telegram isn't
 * connected can't self-reset. The single response message covers every branch —
 * email-not-found, sent, and not-connected — without confirming whether an
 * account exists (no enumeration leak), while still telling not-connected users
 * what to do.
 */
export async function forgotPasswordAction(
  _prev: ForgotState,
  fd: FormData,
): Promise<ForgotState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Enter your email." };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  try {
    await rateLimit(`forgot:ip:${ip}`, { limit: 5, windowSec: 900 });
    await rateLimit(`forgot:email:${email}`, { limit: 3, windowSec: 900 });
  } catch (err) {
    if (err instanceof ApiError && err.status === 429) {
      return { error: "Too many requests. Please wait a few minutes." };
    }
    throw err;
  }

  const doctor = await prisma.doctor.findUnique({
    where: { email },
    include: { telegramLink: true },
  });

  // Only send when the account exists AND has an activated Telegram chat.
  if (doctor?.telegramLink?.chatId) {
    const raw = await createPasswordResetToken(doctor.id);
    const url = `${appBaseUrl()}/reset?t=${raw}`;
    await sendMessage(
      doctor.telegramLink.chatId,
      `Password reset requested for Kordex Health.\nTap to set a new password (valid 15 minutes, one use):\n${url}\n\nIf you didn't request this, ignore this message.`,
    ).catch(() => {});
  }

  return { done: true };
}
