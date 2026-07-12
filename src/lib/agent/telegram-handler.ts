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

  const chatId = String(message.chat.id);

  // "/start <code>" (deep link) or "/link <code>" claims a link code.
  const linkMatch = text.match(/^\/(?:start|link)\s+(\S+)/);
  if (linkMatch) {
    await handleLinking(chatId, linkMatch[1]);
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
  if (link.chatId && link.chatId !== chatId) {
    await sendMessage(chatId, "This code has already been used from another chat.");
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
