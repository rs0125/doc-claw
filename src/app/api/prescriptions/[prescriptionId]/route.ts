import { authenticate } from "@/lib/auth";
import { handle, json } from "@/lib/http";
import { getPrescription } from "@/services/prescriptions";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ prescriptionId: string }> };

// GET /api/prescriptions/:prescriptionId
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const auth = await authenticate(req);
  const { prescriptionId } = await params;
  const prescription = await getPrescription(auth, prescriptionId);
  return json({ prescription });
});
