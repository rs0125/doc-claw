import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import type { AuthContext } from "@/lib/auth";
import { ApiError, json } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type IdempotentResult = { status: number; body: Prisma.InputJsonValue };

/**
 * Replay protection for write endpoints. If the request carries an
 * `Idempotency-Key` header, the first execution stores its response and any
 * retry with the same key gets that response back instead of re-executing
 * (agent loops and flaky networks retry POSTs; without this, retries create
 * duplicate records). Without the header, the operation runs normally.
 */
export async function withIdempotency(
  auth: AuthContext,
  req: Request,
  fn: () => Promise<IdempotentResult>,
): Promise<NextResponse> {
  const key = req.headers.get("idempotency-key");
  if (!key) {
    const { status, body } = await fn();
    return json(body, status);
  }

  // Claim the key. A unique violation means another request got there first.
  try {
    await prisma.idempotencyKey.create({
      data: { doctorId: auth.doctor.id, key },
    });
  } catch (err) {
    if ((err as { code?: string }).code !== "P2002") throw err;
    const existing = await prisma.idempotencyKey.findUnique({
      where: { doctorId_key: { doctorId: auth.doctor.id, key } },
    });
    if (existing?.responseStatus != null) {
      return json(existing.responseBody, existing.responseStatus);
    }
    throw new ApiError(409, "A request with this Idempotency-Key is already in flight");
  }

  try {
    const { status, body } = await fn();
    await prisma.idempotencyKey.update({
      where: { doctorId_key: { doctorId: auth.doctor.id, key } },
      data: { responseStatus: status, responseBody: body },
    });
    return json(body, status);
  } catch (err) {
    // Release the key so the client can retry a failed operation.
    await prisma.idempotencyKey
      .delete({ where: { doctorId_key: { doctorId: auth.doctor.id, key } } })
      .catch(() => {});
    throw err;
  }
}
