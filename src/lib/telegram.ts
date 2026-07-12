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

// Minimal shape of the webhook payload we care about.
export type TelegramUpdate = {
  update_id?: number;
  message?: {
    message_id: number;
    date: number;
    text?: string;
    chat: { id: number; type: string };
    from?: { id: number; first_name?: string };
  };
};
