/**
 * Provision a doctor and issue their first API token.
 *
 *   npm run create-doctor -- --name "Dr. A Sharma" --email a.sharma@example.com \
 *     [--phone ...] [--reg-no ...] [--clinic ...]
 *
 * Prints the raw token ONCE — only its hash is stored.
 */
import "dotenv/config";
import { generateToken } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const name = arg("--name");
  const email = arg("--email");
  if (!name || !email) {
    console.error('Usage: npm run create-doctor -- --name "Dr. X" --email x@example.com');
    process.exit(1);
  }

  try {
    const doctor = await prisma.doctor.upsert({
      where: { email },
      update: {},
      create: {
        name,
        email,
        phone: arg("--phone"),
        registrationNumber: arg("--reg-no"),
        clinicName: arg("--clinic"),
      },
    });

    const { raw, hash } = generateToken();
    await prisma.apiToken.create({
      data: { doctorId: doctor.id, name: arg("--token-name") ?? "default", tokenHash: hash },
    });

    const { randomBytes } = await import("crypto");
    const link = await prisma.telegramLink.upsert({
      where: { doctorId: doctor.id },
      update: {},
      create: { doctorId: doctor.id, linkCode: randomBytes(6).toString("hex") },
    });

    console.log(`Doctor: ${doctor.name} <${doctor.email}> (${doctor.id})`);
    console.log(`API token (save it now, it is not stored): ${raw}`);
    console.log(
      link.chatId
        ? "Telegram: already linked"
        : `Telegram link code: send "/link ${link.linkCode}" to the bot`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
