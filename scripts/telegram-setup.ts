/**
 * One-time (idempotent) Telegram setup: registers the webhook and the slash
 * command menu. Re-run after deploying to a new URL.
 *
 *   npm run telegram-setup -- --url https://kordexhealth.vercel.app
 *
 * Requires TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET in the environment.
 */
import "dotenv/config";
import { BOT_COMMANDS } from "../src/lib/agent/commands";
import { setMyCommands, setWebhook } from "../src/lib/telegram";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const base = arg("--url");
  if (!base) {
    console.error("Usage: npm run telegram-setup -- --url https://<your-deploy>");
    process.exit(1);
  }
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    console.error("Missing TELEGRAM_WEBHOOK_SECRET in the environment");
    process.exit(1);
  }

  const webhookUrl = `${base.replace(/\/$/, "")}/api/telegram/webhook`;
  await setWebhook(webhookUrl, secret);
  console.log(`Webhook set → ${webhookUrl}`);

  await setMyCommands(BOT_COMMANDS);
  console.log(`Registered ${BOT_COMMANDS.length} slash commands: ${BOT_COMMANDS.map((c) => "/" + c.command).join(" ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
