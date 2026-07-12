import { authenticate } from "@/lib/auth";
import { handle, json } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { listQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/audit-logs?limit=&offset= — the doctor's own trail, newest first
export const GET = handle(async (req: Request) => {
  const auth = await authenticate(req);
  const { searchParams } = new URL(req.url);
  const { limit, offset } = listQuerySchema.parse(Object.fromEntries(searchParams));

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: { doctorId: auth.doctor.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.auditLog.count({ where: { doctorId: auth.doctor.id } }),
  ]);

  return json({ logs, total, limit, offset });
});
