import { randomBytes } from "crypto";
import { getSessionDoctor } from "@/lib/web-auth";
import { handle, json, ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const LINK_CODE_TTL_HOURS = 48;

// POST /api/telegram/connect-code — mint (or rotate) a link code for the signed-in
// doctor so they can connect a Telegram chat. Rejects if already linked.
export const POST = handle(async () => {
  const doctor = await getSessionDoctor();
  if (!doctor) throw new ApiError(401, "Not signed in");

  const existing = await prisma.telegramLink.findUnique({ where: { doctorId: doctor.id } });
  if (existing?.chatId) throw new ApiError(409, "A Telegram chat is already connected");

  const linkCode = randomBytes(6).toString("hex");
  const linkCodeExpiresAt = new Date(Date.now() + LINK_CODE_TTL_HOURS * 3600_000);
  await prisma.telegramLink.upsert({
    where: { doctorId: doctor.id },
    update: { linkCode, linkCodeExpiresAt },
    create: { doctorId: doctor.id, linkCode, linkCodeExpiresAt },
  });

  const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? "KordexHealthBot";
  return json({ code: linkCode, botUsername, expiresInHours: LINK_CODE_TTL_HOURS });
});
