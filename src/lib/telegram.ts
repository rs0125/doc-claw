const MAX_MESSAGE_LENGTH = 4096;

function apiUrl(method: string): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Missing env var TELEGRAM_BOT_TOKEN");
  return `https://api.telegram.org/bot${token}/${method}`;
}

async function call(method: string, body: Record<string, unknown>) {
  const res = await fetch(apiUrl(method), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Telegram ${method} failed (${res.status}): ${detail}`);
  }
  return res.json();
}

export async function sendMessage(chatId: string, text: string) {
  // Plain text on purpose: patient data can contain characters that break
  // Telegram markdown parsing, and a failed send is worse than unstyled text.
  for (let i = 0; i < text.length; i += MAX_MESSAGE_LENGTH) {
    await call("sendMessage", { chat_id: chatId, text: text.slice(i, i + MAX_MESSAGE_LENGTH) });
  }
}

/** Sends a document by URL (Telegram fetches it — works with signed R2 URLs). */
export async function sendDocument(chatId: string, url: string, caption?: string) {
  await call("sendDocument", { chat_id: chatId, document: url, caption });
}

/** Sends an image by URL, rendered inline. Works with signed R2 URLs. */
export async function sendPhoto(chatId: string, url: string, caption?: string) {
  await call("sendPhoto", { chat_id: chatId, photo: url, caption });
}

function fileToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Missing env var TELEGRAM_BOT_TOKEN");
  return token;
}

/** Resolve a Telegram file_id to a downloadable file_path. */
export async function getFilePath(fileId: string): Promise<string | null> {
  const res = await call("getFile", { file_id: fileId });
  return res?.result?.file_path ?? null;
}

/** Download the bytes for a Telegram file_path. */
export async function downloadTelegramFile(filePath: string): Promise<Uint8Array> {
  const res = await fetch(`https://api.telegram.org/file/bot${fileToken()}/${filePath}`);
  if (!res.ok) throw new Error(`Telegram file download failed (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Registers the bot's slash-command menu (shown in Telegram's "/" picker). */
export async function setMyCommands(commands: { command: string; description: string }[]) {
  await call("setMyCommands", { commands });
}

/** Points Telegram at our webhook, gated by a secret token header. */
export async function setWebhook(url: string, secretToken: string) {
  await call("setWebhook", {
    url,
    secret_token: secretToken,
    allowed_updates: ["message"],
  });
}

// Minimal shape of the webhook payload we care about.
export type TelegramPhotoSize = { file_id: string; width: number; height: number };
export type TelegramDocument = { file_id: string; file_name?: string; mime_type?: string };

export type TelegramUpdate = {
  update_id?: number;
  message?: {
    message_id: number;
    date: number;
    text?: string;
    caption?: string;
    photo?: TelegramPhotoSize[]; // ascending sizes; last is largest
    document?: TelegramDocument;
    chat: { id: number; type: string };
    from?: { id: number; first_name?: string };
  };
};
