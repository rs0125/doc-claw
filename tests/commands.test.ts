import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  pendingAction: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn(), findFirst: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import type { Doctor } from "@/generated/prisma/client";
import { routeCommand, BOT_COMMANDS } from "@/lib/agent/commands";

const doctor = { id: "doc_1", name: "Dr. Test" } as Doctor;

beforeEach(() => vi.clearAllMocks());

describe("routeCommand", () => {
  it("passes non-commands through to normal chat", async () => {
    expect(await routeCommand(doctor, "what is ramesh on?")).toEqual({ kind: "passthrough" });
  });

  it("routes /help to a direct reply", async () => {
    const r = await routeCommand(doctor, "/help");
    expect(r.kind).toBe("reply");
  });

  it("turns capability commands into agent instructions (preserving confirm flow)", async () => {
    const add = await routeCommand(doctor, "/add Sita Devi, female, 45");
    expect(add).toEqual({ kind: "agent", instruction: "Register a new patient: Sita Devi, female, 45" });

    const find = await routeCommand(doctor, "/find ramesh");
    expect(find).toMatchObject({ kind: "agent" });
    expect((find as { instruction: string }).instruction).toContain("ramesh");
  });

  it("strips the @BotName suffix Telegram adds in groups", async () => {
    const r = await routeCommand(doctor, "/find@KordexHealthBot ramesh");
    expect(r).toMatchObject({ kind: "agent" });
  });

  it("prompts for usage when a capability command has no args", async () => {
    const r = await routeCommand(doctor, "/prescribe");
    expect(r.kind).toBe("reply");
    expect((r as { text: string }).text).toMatch(/usage/i);
  });

  it("reports nothing to cancel when no actions are pending", async () => {
    prismaMock.pendingAction.findMany.mockResolvedValue([]);
    const r = await routeCommand(doctor, "/cancel");
    expect(r).toMatchObject({ kind: "reply" });
    expect((r as { text: string }).text).toMatch(/nothing/i);
  });

  it("cancels all pending actions on /cancel", async () => {
    prismaMock.pendingAction.findMany.mockResolvedValue([{ id: "a1" }, { id: "a2" }]);
    prismaMock.pendingAction.findFirst.mockResolvedValue({ id: "a1", doctorId: "doc_1", status: "PENDING" });
    prismaMock.pendingAction.update.mockResolvedValue({});
    const r = await routeCommand(doctor, "/cancel");
    expect((r as { text: string }).text).toMatch(/cancelled 2/i);
  });

  it("rejects unknown commands with a pointer to /help", async () => {
    const r = await routeCommand(doctor, "/frobnicate");
    expect((r as { text: string }).text).toMatch(/unknown command/i);
  });

  it("keeps the command menu and the router in sync", () => {
    // Every menu command (except help/start) should be routable to a non-reply-error.
    const menu = BOT_COMMANDS.map((c) => c.command);
    expect(menu).toContain("find");
    expect(menu).toContain("prescribe");
  });
});
