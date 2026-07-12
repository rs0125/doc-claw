/**
 * Exercise the agent loop without Telegram — one turn per invocation, using
 * the same persisted conversation the bot would use.
 *
 *   npm run agent -- --email raghav@wareongo.com "find patient ramesh"
 */
import "dotenv/config";
import { runAgentTurn } from "../src/lib/agent/loop";
import { prisma } from "../src/lib/prisma";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("--email");
  const text = process.argv[process.argv.length - 1];
  if (!email || !text || text.startsWith("--")) {
    console.error('Usage: npm run agent -- --email <doctor-email> "message"');
    process.exit(1);
  }

  const doctor = await prisma.doctor.findUnique({ where: { email } });
  if (!doctor) {
    console.error(`No doctor with email ${email}`);
    process.exit(1);
  }

  const message = await prisma.conversationMessage.create({
    data: { doctorId: doctor.id, role: "user", content: text },
  });

  const reply = await runAgentTurn(doctor, message.createdAt);
  console.log(reply);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
