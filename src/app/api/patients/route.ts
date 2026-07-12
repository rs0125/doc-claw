import { authenticate } from "@/lib/auth";
import { audit, auditRead } from "@/lib/audit";
import { handle, json } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { listQuerySchema, patientCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/patients?q=<name or phone>&limit=&offset=
export const GET = handle(async (req: Request) => {
  const auth = await authenticate(req);
  const { searchParams } = new URL(req.url);
  const { q, limit, offset } = listQuerySchema.parse(Object.fromEntries(searchParams));

  const where = {
    doctorId: auth.doctor.id,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q } },
          ],
        }
      : {}),
  };

  const [patients, total] = await Promise.all([
    prisma.patient.findMany({ where, orderBy: { updatedAt: "desc" }, take: limit, skip: offset }),
    prisma.patient.count({ where }),
  ]);

  auditRead(auth, {
    action: "patient.search",
    resourceType: "Patient",
    details: { q: q ?? null, results: patients.length },
  });

  return json({ patients, total, limit, offset });
});

// POST /api/patients
export const POST = handle(async (req: Request) => {
  const auth = await authenticate(req);
  const data = patientCreateSchema.parse(await req.json());

  const patient = await prisma.$transaction(async (tx) => {
    const created = await tx.patient.create({
      data: { ...data, doctorId: auth.doctor.id },
    });
    await audit(
      auth,
      { action: "patient.create", resourceType: "Patient", resourceId: created.id },
      tx,
    );
    return created;
  });

  return json({ patient }, 201);
});
