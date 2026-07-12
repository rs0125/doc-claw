import type { AttachmentKind, Doctor } from "@/generated/prisma/client";
import { routeCommand } from "@/lib/agent/commands";
import { runAgentTurn } from "@/lib/agent/loop";
import { agentAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  downloadTelegramFile,
  getFilePath,
  sendMessage,
  type TelegramUpdate,
} from "@/lib/telegram";
import { ingestAttachment } from "@/services/attachments";
import { searchPatients } from "@/services/patients";

/**
 * Handles one Telegram update end-to-end: linking, persisting the message,
 * running the agent, replying. Runs after the webhook has already returned 200.
 */
export async function handleTelegramUpdate(update: TelegramUpdate) {
  const message = update.message;
  const text = message?.text?.trim();
  const hasMedia = !!(message?.photo?.length || message?.document);
  if (!message || message.chat.type !== "private" || (!text && !hasMedia)) return;

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
  const linkMatch = text?.match(/^\/(?:start|link)\s+(\S+)/);
  if (linkMatch) {
    await handleLinking(chatId, linkMatch[1]);
    return;
  }

  if (text && /^\/unlink\b/.test(text)) {
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

  // Photo / document upload: store it against a patient named in the caption.
  if (hasMedia) {
    await handleMediaUpload(link.doctor, chatId, message);
    return;
  }

  // Slash commands are a shortcut layer: informational ones reply directly,
  // capability ones ("/add …") turn into an instruction fed to the SAME agent,
  // so confirm-before-write and patient selection still apply. Non-commands
  // pass straight through as normal chat.
  const routed = await routeCommand(link.doctor, text!);
  if (routed.kind === "reply") {
    await sendMessage(chatId, routed.text);
    return;
  }
  const agentInput = routed.kind === "agent" ? routed.instruction : text!;

  const userMessage = await prisma.conversationMessage.create({
    data: { doctorId: link.doctorId, role: "user", content: agentInput },
  });

  try {
    const reply = await runAgentTurn(link.doctor, userMessage.createdAt, { chatId });
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

// Map caption keywords to an attachment kind.
function kindFromCaption(caption: string): AttachmentKind {
  const c = caption.toLowerCase();
  if (/\b(rx|prescription|prescrip)\b/.test(c)) return "PRESCRIPTION";
  if (/\b(discharge|summary)\b/.test(c)) return "DISCHARGE_SUMMARY";
  if (/\b(lab|report|scan|x-?ray|test)\b/.test(c)) return "LAB_REPORT";
  return "OTHER";
}

const KIND_WORDS =
  /\b(rx|prescription|prescrip|discharge|summary|lab|report|scan|x-?ray|test|photo|pic|image|of|for|the|patient)\b/gi;

/**
 * Stores a photo/document sent to the bot against the patient named in the
 * caption. Uploads are low-risk (additive), so we store immediately and confirm,
 * rather than using the pending-action flow. Requires a caption naming a patient.
 */
async function handleMediaUpload(
  doctor: Doctor,
  chatId: string,
  message: NonNullable<TelegramUpdate["message"]>,
) {
  const caption = (message.caption ?? "").trim();
  if (!caption) {
    await sendMessage(
      chatId,
      "Please resend the photo with a caption naming the patient, e.g. \"Ramesh Kumar prescription\".",
    );
    return;
  }

  const auth = agentAuth(doctor);
  const kind = kindFromCaption(caption);
  // Strip kind/filler words to leave the patient name for the search.
  const nameQuery = caption.replace(KIND_WORDS, " ").replace(/\s+/g, " ").trim() || caption;

  const { patients } = await searchPatients(auth, { q: nameQuery, limit: 5, offset: 0 });
  if (patients.length === 0) {
    await sendMessage(chatId, `No patient found matching "${nameQuery}". Check the name and resend.`);
    return;
  }
  if (patients.length > 1) {
    const list = patients.map((p, i) => `${i + 1}. ${p.name}${p.phone ? ` (${p.phone})` : ""}`).join("\n");
    await sendMessage(
      chatId,
      `Several patients match "${nameQuery}":\n${list}\nResend the photo with the full name so I attach it to the right patient.`,
    );
    return;
  }
  const patient = patients[0];

  // Resolve the file: largest photo size, or the document.
  const photo = message.photo?.[message.photo.length - 1];
  const fileId = photo?.file_id ?? message.document?.file_id;
  const contentType = photo
    ? "image/jpeg"
    : message.document?.mime_type ?? "application/octet-stream";
  const fileName = message.document?.file_name;
  if (!fileId) return;

  try {
    const filePath = await getFilePath(fileId);
    if (!filePath) throw new Error("no file path");
    const bytes = await downloadTelegramFile(filePath);
    await ingestAttachment(auth, {
      patientId: patient.id,
      kind,
      contentType,
      fileName,
      bytes,
      source: "telegram",
    });
    const kindLabel = kind.toLowerCase().replace("_", " ");
    await sendMessage(
      chatId,
      `Saved to ${patient.name}'s ${kindLabel} files. You can view or remove it from the web dashboard.`,
    );
  } catch (err) {
    console.error("media upload failed", err);
    await sendMessage(chatId, "Sorry, I couldn't save that file. Please try again.");
  }
}
