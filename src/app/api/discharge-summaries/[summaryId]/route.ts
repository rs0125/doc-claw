import { authenticate } from "@/lib/auth";
import { handle, json } from "@/lib/http";
import { summaryUpdateSchema } from "@/lib/validation";
import { getSummary, updateSummary } from "@/services/summaries";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ summaryId: string }> };

// GET /api/discharge-summaries/:summaryId
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const auth = await authenticate(req);
  const { summaryId } = await params;
  const summary = await getSummary(auth, summaryId);
  return json({ summary });
});

// PATCH /api/discharge-summaries/:summaryId — edit fields and/or finalize (status: FINAL)
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const auth = await authenticate(req);
  const { summaryId } = await params;
  const data = summaryUpdateSchema.parse(await req.json());
  const summary = await updateSummary(auth, summaryId, data);
  return json({ summary });
});
