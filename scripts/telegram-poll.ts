/**
 * Local demo runner: drive the bot via Telegram long-polling instead of a
 * public webhook. Runs the SAME handler the webhook uses, so behavior is
 * identical — but needs no deployment or tunnel. Ctrl-C to stop.
 *
 *   npm run telegram-poll
 *
 * Note: getUpdates and a webhook are mutually exclusive. If a webhook is set,
 * this deletes it first (re-run telegram-setup later to restore it).
 */
import "dotenv/config";
import { handleTelegramUpdate } from "../src/lib/agent/telegram-handler";
import { BOT_COMMANDS } from "../src/lib/agent/commands";
import { setMyCommands } from "../src/lib/telegram";
import type { TelegramUpdate } from "../src/lib/telegram";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) throw new Error("Missing TELEGRAM_BOT_TOKEN");
const API = `https://api.telegram.org/bot${TOKEN}`;

async function tg(method: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function main() {
  await tg("deleteWebhook"); // free the bot for long-polling
  await setMyCommands(BOT_COMMANDS);
  const me = await tg("getMe");
  console.log(`Polling as @${me.result?.username} — send it a message. Ctrl-C to stop.`);

  let offset = 0;
  while (true) {
    let data: { ok: boolean; result?: (TelegramUpdate & { update_id: number })[] };
    try {
      data = await tg("getUpdates", { offset, timeout: 30, allowed_updates: ["message"] });
    } catch (err) {
      console.error("getUpdates failed, retrying:", (err as Error).message);
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }
    for (const update of data.result ?? []) {
      offset = update.update_id + 1;
      const text = update.message?.text ?? "";
      console.log(`↩ [${update.message?.chat?.id}] ${text.slice(0, 80)}`);
      try {
        await handleTelegramUpdate(update);
      } catch (err) {
        console.error("handler error:", (err as Error).message);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
