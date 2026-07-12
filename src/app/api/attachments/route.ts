import { z } from "zod";
import { getSessionDoctor, webAuth } from "@/lib/web-auth";
import { handle, json, ApiError } from "@/lib/http";
import { createAttachment } from "@/services/attachments";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  patientId: z.string().min(1),
  kind: z.enum(["PRESCRIPTION", "DISCHARGE_SUMMARY", "LAB_REPORT", "OTHER"]),
  contentType: z.string().min(1),
  fileName: z.string().optional(),
  prescriptionId: z.string().optional(),
  dischargeSummaryId: z.string().optional(),
});

// POST /api/attachments — register an upload and get a presigned PUT URL.
export const POST = handle(async (req: Request) => {
  const doctor = await getSessionDoctor();
  if (!doctor) throw new ApiError(401, "Not signed in");
  const data = bodySchema.parse(await req.json());
  const { attachment, uploadUrl } = await createAttachment(webAuth(doctor), data);
  return json({ attachmentId: attachment.id, uploadUrl }, 201);
});
