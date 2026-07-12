/**
 * Set (or reset) a doctor's web login password.
 *   npm run set-password -- --email raghav@wareongo.com --password "secret123"
 */
import "dotenv/config";
import { hashPassword } from "../src/lib/password";
import { prisma } from "../src/lib/prisma";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("--email");
  const password = arg("--password");
  if (!email || !password) {
    console.error('Usage: npm run set-password -- --email <email> --password "<password>"');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }
  const doctor = await prisma.doctor.update({
    where: { email },
    data: { passwordHash: await hashPassword(password) },
  });
  console.log(`Password set for ${doctor.name} <${doctor.email}>.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
