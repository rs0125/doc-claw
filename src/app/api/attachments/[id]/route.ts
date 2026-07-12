import { getSessionDoctor, webAuth } from "@/lib/web-auth";
import { handle, json, ApiError } from "@/lib/http";
import { deleteAttachment } from "@/services/attachments";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// DELETE /api/attachments/:id — remove an uploaded photo/document (and its R2 object).
export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const doctor = await getSessionDoctor();
  if (!doctor) throw new ApiError(401, "Not signed in");
  const { id } = await params;
  await deleteAttachment(webAuth(doctor), id);
  return json({ ok: true });
});
