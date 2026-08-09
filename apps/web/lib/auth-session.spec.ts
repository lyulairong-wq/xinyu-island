import { describe, expect, it } from "vitest";
import { createTokenStorage } from "./auth-session";

describe("createTokenStorage", () => {
  it("persists, reads, and clears the access token", () => {
    const storage = new Map<string, string>();
    const adapter = createTokenStorage({
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key)
    });

    adapter.write("token-1");

    expect(storage.get("xinyu_access_token")).toBe("token-1");
    expect(adapter.read()).toBe("token-1");

    adapter.clear();

    expect(adapter.read()).toBeNull();
  });
});
