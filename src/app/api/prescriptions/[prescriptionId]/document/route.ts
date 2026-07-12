import { authenticate } from "@/lib/auth";
import { handle, json } from "@/lib/http";
import { getPrescriptionDocumentUrl } from "@/services/prescriptions";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ prescriptionId: string }> };

// GET /api/prescriptions/:prescriptionId/document
// Renders the PDF to R2 (if missing or stale) and returns a short-lived signed URL.
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const auth = await authenticate(req);
  const { prescriptionId } = await params;
  const result = await getPrescriptionDocumentUrl(auth, prescriptionId);
  return json(result);
});
