import { NextResponse } from "next/server";
import { redeemLoginToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/web-auth";

export const dynamic = "force-dynamic";

// GET /login?t=<one-time token> — from the bot's /web link. Exchanges the token
// for a session cookie and redirects into the dashboard.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t");
  const origin = new URL(req.url).origin;

  if (!token) {
    return NextResponse.redirect(new URL("/login/error", origin));
  }

  const rawSession = await redeemLoginToken(token);
  if (!rawSession) {
    return NextResponse.redirect(new URL("/login/error", origin));
  }

  const res = NextResponse.redirect(new URL("/dashboard", origin));
  res.cookies.set(SESSION_COOKIE, rawSession, sessionCookieOptions);
  return res;
}
