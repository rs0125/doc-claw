/**
 * Manage a doctor's Telegram link.
 *
 *   npm run telegram-link -- --email a@example.com            # mint a fresh link code (48h validity)
 *   npm run telegram-link -- --email a@example.com --revoke   # kick the linked chat out (lost/stolen phone)
 */
import "dotenv/config";
import { randomBytes } from "crypto";
import { prisma } from "../src/lib/prisma";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("--email");
  const revoke = process.argv.includes("--revoke");
  if (!email) {
    console.error("Usage: npm run telegram-link -- --email <doctor-email> [--revoke]");
    process.exit(1);
  }

  const doctor = await prisma.doctor.findUnique({
    where: { email },
    include: { telegramLink: true },
  });
  if (!doctor) {
    console.error(`No doctor with email ${email}`);
    process.exit(1);
  }

  const linkCode = randomBytes(6).toString("hex");
  const linkCodeExpiresAt = new Date(Date.now() + 48 * 3600_000);

  const link = await prisma.telegramLink.upsert({
    where: { doctorId: doctor.id },
    update: revoke
      ? { chatId: null, linkedAt: null, linkCode, linkCodeExpiresAt }
      : { linkCode, linkCodeExpiresAt },
    create: { doctorId: doctor.id, linkCode, linkCodeExpiresAt },
  });

  if (revoke) console.log("Previous chat unlinked — it no longer has access.");
  if (!revoke && link.chatId) {
    console.log("Note: a chat is already linked; the new code is for relinking after /unlink.");
  }
  console.log(`Link code (valid 48h): send "/link ${linkCode}" to the bot`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
