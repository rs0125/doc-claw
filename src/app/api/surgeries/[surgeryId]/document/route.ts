import { authenticate } from "@/lib/auth";
import { handle, json } from "@/lib/http";
import { getSurgeryDocumentUrl } from "@/services/surgeries";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ surgeryId: string }> };

// GET /api/surgeries/:surgeryId/document
// Renders the PDF to R2 (if missing or stale) and returns a short-lived signed URL.
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const auth = await authenticate(req);
  const { surgeryId } = await params;
  const result = await getSurgeryDocumentUrl(auth, surgeryId);
  return json(result);
});
