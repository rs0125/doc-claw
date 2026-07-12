import { NextResponse } from "next/server";
import { getSessionDoctor, webAuth } from "@/lib/web-auth";
import { getSummaryDocumentUrl } from "@/services/summaries";

export const dynamic = "force-dynamic";

// GET /dl/summary/:id — session-guarded; redirects to a short-lived signed R2
// URL for the rendered PDF.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const doctor = await getSessionDoctor();
  if (!doctor) return NextResponse.redirect(new URL("/login", new URL(req.url).origin));
  const { id } = await params;
  try {
    const { url } = await getSummaryDocumentUrl(webAuth(doctor), id);
    return NextResponse.redirect(url);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
