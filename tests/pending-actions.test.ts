import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  pendingAction: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import type { Doctor } from "@/generated/prisma/client";
import { agentAuth } from "@/lib/auth";
import { ApiError } from "@/lib/http";
import { cancelAction, confirmAction, proposeAction } from "@/services/pending-actions";

const auth = agentAuth({ id: "doc_1", name: "Dr. Test" } as Doctor);
const NOW = Date.now();

function pendingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "act_1",
    doctorId: "doc_1",
    type: "patient.create",
    payload: { data: { name: "Ramesh" } },
    status: "PENDING",
    createdAt: new Date(NOW - 60_000), // proposed a minute ago
    expiresAt: new Date(NOW + 10 * 60_000),
    resolvedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("proposeAction", () => {
  it("rejects malformed payloads before storing anything", async () => {
    await expect(
      proposeAction(auth, "patient.create", { data: { name: "" } }),
    ).rejects.toThrow();
    expect(prismaMock.pendingAction.create).not.toHaveBeenCalled();
  });

  it("stores a valid proposal without executing it", async () => {
    prismaMock.pendingAction.findMany.mockResolvedValue([]);
    prismaMock.pendingAction.create.mockResolvedValue(pendingRow());
    const result = await proposeAction(auth, "patient.create", { data: { name: "Ramesh" } });
    expect(prismaMock.pendingAction.create).toHaveBeenCalledOnce();
    expect(result.status).toBe("created");
  });

  it("returns the existing pending action instead of duplicating an identical proposal", async () => {
    prismaMock.pendingAction.findMany.mockResolvedValue([
      pendingRow({ payload: { data: { name: "Ramesh" } } }),
    ]);
    const result = await proposeAction(auth, "patient.create", { data: { name: "Ramesh" } });
    expect(result.status).toBe("duplicate_pending");
    expect(prismaMock.pendingAction.create).not.toHaveBeenCalled();
  });

  it("flags an identical recently-confirmed action as already saved", async () => {
    prismaMock.pendingAction.findMany.mockResolvedValue([
      pendingRow({ status: "CONFIRMED", payload: { data: { name: "Ramesh" } } }),
    ]);
    const result = await proposeAction(auth, "patient.create", { data: { name: "Ramesh" } });
    expect(result.status).toBe("already_saved");
    expect(prismaMock.pendingAction.create).not.toHaveBeenCalled();
  });

  it("treats differing payloads as new proposals", async () => {
    prismaMock.pendingAction.findMany.mockResolvedValue([
      pendingRow({ payload: { data: { name: "Ramesh" } } }),
    ]);
    prismaMock.pendingAction.create.mockResolvedValue(pendingRow());
    const result = await proposeAction(auth, "patient.create", { data: { name: "Different" } });
    expect(result.status).toBe("created");
    expect(prismaMock.pendingAction.create).toHaveBeenCalledOnce();
  });
});

describe("confirmAction gating", () => {
  it("404s on an unknown or foreign action", async () => {
    prismaMock.pendingAction.findFirst.mockResolvedValue(null);
    await expect(confirmAction(auth, "act_x", new Date(NOW))).rejects.toMatchObject({
      status: 404,
    });
  });

  it("409s on an already-resolved action", async () => {
    prismaMock.pendingAction.findFirst.mockResolvedValue(pendingRow({ status: "CONFIRMED" }));
    await expect(confirmAction(auth, "act_1", new Date(NOW))).rejects.toMatchObject({
      status: 409,
    });
  });

  it("410s and marks an expired action EXPIRED", async () => {
    prismaMock.pendingAction.findFirst.mockResolvedValue(
      pendingRow({ expiresAt: new Date(NOW - 1000) }),
    );
    prismaMock.pendingAction.update.mockResolvedValue({});
    await expect(confirmAction(auth, "act_1", new Date(NOW))).rejects.toMatchObject({
      status: 410,
    });
    expect(prismaMock.pendingAction.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "EXPIRED" }) }),
    );
  });

  it("rejects same-turn confirmation: action proposed at/after the doctor's current message", async () => {
    // The doctor's message arrived at NOW-2min; the model proposed at NOW-1min
    // (during this turn) and immediately tries to confirm. Must be blocked.
    prismaMock.pendingAction.findFirst.mockResolvedValue(pendingRow());
    await expect(confirmAction(auth, "act_1", new Date(NOW - 120_000))).rejects.toMatchObject({
      status: 409,
    });
    expect(prismaMock.pendingAction.update).not.toHaveBeenCalled();
  });

  it("surfaces same-turn rejection as an ApiError the agent can relay", async () => {
    prismaMock.pendingAction.findFirst.mockResolvedValue(pendingRow());
    const err = await confirmAction(auth, "act_1", new Date(NOW - 120_000)).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toMatch(/next message/);
  });
});

describe("cancelAction", () => {
  it("cancels a pending action", async () => {
    prismaMock.pendingAction.findFirst.mockResolvedValue(pendingRow());
    prismaMock.pendingAction.update.mockResolvedValue(pendingRow({ status: "CANCELLED" }));
    const result = await cancelAction(auth, "act_1");
    expect(result.status).toBe("CANCELLED");
  });

  it("409s when cancelling an already-resolved action", async () => {
    prismaMock.pendingAction.findFirst.mockResolvedValue(pendingRow({ status: "CONFIRMED" }));
    await expect(cancelAction(auth, "act_1")).rejects.toMatchObject({ status: 409 });
  });
});
