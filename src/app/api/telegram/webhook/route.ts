import { timingSafeEqual } from "crypto";
import { after } from "next/server";
import { handleTelegramUpdate } from "@/lib/agent/telegram-handler";
import { json } from "@/lib/http";
import type { TelegramUpdate } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // agent turns run in after(); allow time on Vercel

function secretMatches(header: string | null): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!header || !expected) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// POST /api/telegram/webhook — set via Telegram setWebhook with secret_token.
export const POST = async (req: Request) => {
  if (!secretMatches(req.headers.get("x-telegram-bot-api-secret-token"))) {
    return json({ error: "Unauthorized" }, 401);
  }

  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }

  // Ack immediately so Telegram doesn't retry; the agent runs afterwards.
  after(async () => {
    try {
      await handleTelegramUpdate(update);
    } catch (err) {
      console.error("telegram update failed", err);
    }
  });

  return json({ ok: true });
};
