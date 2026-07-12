import { randomBytes } from "crypto";
import { getSessionDoctor } from "@/lib/web-auth";
import { handle, json, ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

// POST /api/telegram/revoke — disconnect the linked Telegram chat. Rotates the
// link code (issuing a fresh id), clears the chat, and notifies that chat.
export const POST = handle(async () => {
  const doctor = await getSessionDoctor();
  if (!doctor) throw new ApiError(401, "Not signed in");

  const link = await prisma.telegramLink.findUnique({ where: { doctorId: doctor.id } });
  if (!link?.chatId) throw new ApiError(409, "No Telegram chat is connected");

  const oldChatId = link.chatId;
  await prisma.telegramLink.update({
    where: { id: link.id },
    data: {
      chatId: null,
      linkedAt: null,
      linkCode: randomBytes(9).toString("hex"),
      linkCodeExpiresAt: new Date(), // expired; a fresh code must be minted to relink
    },
  });

  // Best-effort: tell the now-disconnected chat.
  await sendMessage(
    oldChatId,
    "Access for this chat has been revoked from the Kordex Health dashboard. " +
      "This chat can no longer view or change any patient records. To reconnect, get a new link code from the dashboard.",
  ).catch(() => {});

  return json({ ok: true });
});
