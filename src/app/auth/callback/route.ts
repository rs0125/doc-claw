import { NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { redeemLoginToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/web-auth";

export const dynamic = "force-dynamic";

/**
 * Magic-link sign-in from the bot's /web link.
 *
 * GET only RENDERS — it must not consume the single-use token, because link
 * preview crawlers (Telegram, etc.) fetch the URL to build a preview card and
 * would burn the token before the doctor taps it. The page immediately POSTs
 * back to consume the token; crawlers don't run JS, so the token survives for
 * the real click. A no-JS fallback button covers the rare case.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const origin = new URL(req.url).origin;
  if (!token) return NextResponse.redirect(new URL("/login/error", origin));

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Signing you in…</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#fff;color:#171717;
       display:flex;min-height:100dvh;align-items:center;justify-content:center;margin:0}
  .box{text-align:center;padding:24px}
  .muted{color:#71717a;font-size:14px;margin-top:8px}
  button{margin-top:16px;height:44px;padding:0 20px;border:0;border-radius:10px;background:#171717;color:#fff;font-size:15px;font-weight:600}
</style>
</head>
<body>
  <div class="box">
    <div>Signing you in…</div>
    <div class="muted">One moment.</div>
    <form id="f" method="POST" action="/auth/callback">
      <input type="hidden" name="t" value="${token.replace(/"/g, "")}" />
      <noscript><button type="submit">Continue to dashboard</button></noscript>
    </form>
  </div>
  <script>document.getElementById('f').submit();</script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

// POST consumes the token (single-use), sets the session cookie, and enters the app.
export async function POST(req: Request) {
  const origin = new URL(req.url).origin;
  // Throttle token-guessing on the consume endpoint.
  try {
    await rateLimit(`auth-callback:${clientIp(req)}`, { limit: 20, windowSec: 300 });
  } catch {
    return NextResponse.redirect(new URL("/login/error", origin), 303);
  }
  const form = await req.formData();
  const token = String(form.get("t") ?? "");
  if (!token) return NextResponse.redirect(new URL("/login/error", origin), 303);

  const rawSession = await redeemLoginToken(token);
  if (!rawSession) return NextResponse.redirect(new URL("/login/error", origin), 303);

  const res = NextResponse.redirect(new URL("/dashboard", origin), 303);
  res.cookies.set(SESSION_COOKIE, rawSession, sessionCookieOptions);
  return res;
}
