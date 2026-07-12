import { runAgentTurn } from "@/lib/agent/loop";
import { prisma } from "@/lib/prisma";
import { sendMessage, type TelegramUpdate } from "@/lib/telegram";

/**
 * Handles one Telegram update end-to-end: linking, persisting the message,
 * running the agent, replying. Runs after the webhook has already returned 200.
 */
export async function handleTelegramUpdate(update: TelegramUpdate) {
  const message = update.message;
  const text = message?.text?.trim();
  if (!message || !text || message.chat.type !== "private") return;

  // Replay protection: Telegram redelivers updates it thinks we missed.
  if (typeof update.update_id === "number") {
    try {
      await prisma.processedTelegramUpdate.create({
        data: { updateId: BigInt(update.update_id) },
      });
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") return; // already handled
      throw err;
    }
  }

  const chatId = String(message.chat.id);

  // "/start <code>" (deep link) or "/link <code>" claims a link code.
  const linkMatch = text.match(/^\/(?:start|link)\s+(\S+)/);
  if (linkMatch) {
    await handleLinking(chatId, linkMatch[1]);
    return;
  }

  if (/^\/unlink\b/.test(text)) {
    await handleUnlinking(chatId);
    return;
  }

  const link = await prisma.telegramLink.findUnique({
    where: { chatId },
    include: { doctor: true },
  });
  if (!link) {
    await sendMessage(
      chatId,
      "This chat is not linked to a doctor account. Send /link <code> using the link code you were given.",
    );
    return;
  }

  const userMessage = await prisma.conversationMessage.create({
    data: { doctorId: link.doctorId, role: "user", content: text },
  });

  try {
    const reply = await runAgentTurn(link.doctor, userMessage.createdAt);
    await sendMessage(chatId, reply);
  } catch (err) {
    console.error("agent turn failed", err);
    await sendMessage(chatId, "Something went wrong on my side. Please try again.").catch(
      () => {},
    );
  }
}

async function handleLinking(chatId: string, code: string) {
  const link = await prisma.telegramLink.findUnique({
    where: { linkCode: code },
    include: { doctor: true },
  });
  if (!link) {
    await sendMessage(chatId, "That link code is not valid.");
    return;
  }
  if (link.chatId === chatId) {
    await sendMessage(chatId, "This chat is already linked.");
    return;
  }
  if (link.chatId) {
    await sendMessage(chatId, "This code has already been used from another chat.");
    return;
  }
  if (link.linkCodeExpiresAt && link.linkCodeExpiresAt < new Date()) {
    await sendMessage(
      chatId,
      "This link code has expired. Generate a new one with: npm run telegram-link",
    );
    return;
  }

  await prisma.telegramLink.update({
    where: { id: link.id },
    data: { chatId, linkedAt: new Date() },
  });
  await sendMessage(
    chatId,
    `Linked to ${link.doctor.name}. You can now manage your patients here — try "find patient <name>" or "add a new patient".`,
  );
}

async function handleUnlinking(chatId: string) {
  const link = await prisma.telegramLink.findUnique({ where: { chatId } });
  if (!link) {
    await sendMessage(chatId, "This chat is not linked to any account.");
    return;
  }
  // Rotate the code to a value nobody has seen and expire it immediately:
  // relinking requires minting a fresh code with the telegram-link script.
  const { randomBytes } = await import("crypto");
  await prisma.telegramLink.update({
    where: { id: link.id },
    data: {
      chatId: null,
      linkedAt: null,
      linkCode: randomBytes(9).toString("hex"),
      linkCodeExpiresAt: new Date(),
    },
  });
  await sendMessage(chatId, "Unlinked. This chat no longer has access to any patient records.");
}
