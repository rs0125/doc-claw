import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ApiError, handle, json } from "@/lib/http";

describe("handle()", () => {
  it("passes through the handler's response", async () => {
    const route = handle(async () => json({ ok: true }, 201));
    const res = await route();
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("maps ApiError to its status and message", async () => {
    const route = handle(async () => {
      throw new ApiError(404, "Patient not found");
    });
    const res = await route();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Patient not found" });
  });

  it("maps ZodError to a 400 with field-level issues", async () => {
    const route = handle(async () => {
      z.object({ name: z.string().min(1) }).parse({ name: "" });
      return json({});
    });
    const res = await route();
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
    expect(body.issues[0].path).toBe("name");
  });

  it("maps unexpected errors to an opaque 500", async () => {
    const route = handle(async () => {
      throw new Error("secret internal detail");
    });
    const res = await route();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain("secret internal detail");
  });
});
