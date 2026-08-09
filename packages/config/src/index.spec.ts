import { describe, expect, it } from "vitest";
import { loadConfig } from "./index";

describe("loadConfig", () => {
  it("rejects a missing JWT secret in development", () => {
    expect(() => loadConfig({ DATABASE_URL: "postgresql://localhost/xinyu" })).toThrow("JWT_SECRET");
  });
});
