import { getSessionDoctor, webAuth } from "@/lib/web-auth";
import { handle, json, ApiError } from "@/lib/http";
import { completeAttachment } from "@/services/attachments";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/attachments/:id/complete — mark the R2 upload finished.
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const doctor = await getSessionDoctor();
  if (!doctor) throw new ApiError(401, "Not signed in");
  const { id } = await params;
  await completeAttachment(webAuth(doctor), id);
  return json({ ok: true });
});
