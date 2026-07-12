import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

/**
 * Fixed-window rate limiter, backed by Postgres so it holds across serverless
 * instances. Throws ApiError(429) when the bucket exceeds `limit` in the window.
 * Fails open (allows the request) if the limiter itself errors — availability
 * over strictness for a demo-scale guard.
 */
export async function rateLimit(
  bucket: string,
  { limit, windowSec }: { limit: number; windowSec: number },
): Promise<void> {
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / (windowSec * 1000)) * windowSec * 1000);
  try {
    const row = await prisma.rateLimitHit.upsert({
      where: { bucket_windowStart: { bucket, windowStart } },
      create: { bucket, windowStart, count: 1 },
      update: { count: { increment: 1 } },
    });
    if (row.count > limit) {
      throw new ApiError(429, "Too many requests. Please wait a moment and try again.");
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.error("rateLimit failed (allowing):", err);
  }
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  return xff?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}
