import { describe, expect, it } from "vitest";
import { generateToken, hashToken } from "@/lib/auth";

describe("token generation", () => {
  it("produces a dct_-prefixed token and its sha256 hash", () => {
    const { raw, hash } = generateToken();
    expect(raw).toMatch(/^dct_[a-f0-9]{48}$/);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken(raw)).toBe(hash);
  });

  it("never produces the same token twice", () => {
    const seen = new Set(Array.from({ length: 100 }, () => generateToken().raw));
    expect(seen.size).toBe(100);
  });

  it("hashing is deterministic and never exposes the raw token", () => {
    expect(hashToken("dct_abc")).toBe(hashToken("dct_abc"));
    expect(hashToken("dct_abc")).not.toContain("abc");
  });
});
