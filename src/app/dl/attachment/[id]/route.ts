import { NextResponse } from "next/server";
import { getSessionDoctor, webAuth } from "@/lib/web-auth";
import { getAttachmentUrl } from "@/services/attachments";

export const dynamic = "force-dynamic";

// GET /dl/attachment/:id — session-guarded; redirects to a short-lived signed
// R2 URL for the uploaded image/document.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const doctor = await getSessionDoctor();
  if (!doctor) return NextResponse.redirect(new URL("/login", new URL(req.url).origin));
  const { id } = await params;
  try {
    const { url } = await getAttachmentUrl(webAuth(doctor), id);
    return NextResponse.redirect(url);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
