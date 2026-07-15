import { authenticate } from "@/lib/auth";
import { handle, json } from "@/lib/http";
import { surgeryUpdateSchema } from "@/lib/validation";
import { getSurgery, updateSurgery } from "@/services/surgeries";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ surgeryId: string }> };

// GET /api/surgeries/:surgeryId
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const auth = await authenticate(req);
  const { surgeryId } = await params;
  const surgery = await getSurgery(auth, surgeryId);
  return json({ surgery });
});

// PATCH /api/surgeries/:surgeryId — edit fields
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const auth = await authenticate(req);
  const { surgeryId } = await params;
  const data = surgeryUpdateSchema.parse(await req.json());
  const surgery = await updateSurgery(auth, surgeryId, data);
  return json({ surgery });
});
