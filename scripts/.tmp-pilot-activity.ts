/** Read-only report: pilot account logins + entries created. Temporary; delete after use. */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const pilots = await prisma.doctor.findMany({
    where: { email: { endsWith: "@pilot.com" } },
    orderBy: { email: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      webSessions: { orderBy: { createdAt: "desc" }, select: { createdAt: true } },
      patients: {
        orderBy: { createdAt: "asc" },
        select: { name: true, createdAt: true, archivedAt: true },
      },
      encounters: { select: { createdAt: true, complaint: true, patient: { select: { name: true } } } },
      prescriptions: { select: { createdAt: true, patient: { select: { name: true } } } },
      dischargeSummaries: { select: { createdAt: true, patient: { select: { name: true } } } },
      attachments: { select: { createdAt: true, kind: true, uploadedAt: true } },
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { action: true, createdAt: true },
      },
    },
  });

  for (const d of pilots) {
    console.log(`\n=== ${d.name} <${d.email}> ===`);
    console.log(`Web sessions (logins): ${d.webSessions.length}`);
    for (const s of d.webSessions.slice(0, 5)) console.log(`  - ${s.createdAt.toISOString()}`);
    console.log(`Patients: ${d.patients.length}`);
    for (const p of d.patients)
      console.log(`  - ${p.name} (created ${p.createdAt.toISOString()}${p.archivedAt ? ", archived" : ""})`);
    console.log(`Encounters: ${d.encounters.length}`);
    for (const e of d.encounters)
      console.log(`  - ${e.patient.name}: "${e.complaint}" (${e.createdAt.toISOString()})`);
    console.log(`Prescriptions: ${d.prescriptions.length}`);
    for (const p of d.prescriptions) console.log(`  - ${p.patient.name} (${p.createdAt.toISOString()})`);
    console.log(`Discharge summaries: ${d.dischargeSummaries.length}`);
    console.log(`Attachments: ${d.attachments.length}`);
    console.log(`Last audit actions:`);
    for (const a of d.auditLogs) console.log(`  - ${a.action} @ ${a.createdAt.toISOString()}`);
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
