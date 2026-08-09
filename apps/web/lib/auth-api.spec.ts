import { afterEach, describe, expect, it, vi } from "vitest";
import { logout } from "./auth-api";

describe("logout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves when the server returns 204 without a response body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(logout("access-token")).resolves.toBeUndefined();
  });
});
