import { describe, expect, it } from "vitest";
import { loadBetaConfig, loadConfig } from "./index";

describe("loadConfig", () => {
  const validEnv = {
    DATABASE_URL: "postgresql://localhost/xinyu",
    JWT_SECRET: "12345678901234567890123456789012"
  };

  it("rejects a missing JWT secret in development", () => {
    expect(() => loadConfig({ DATABASE_URL: "postgresql://localhost/xinyu" })).toThrow("JWT_SECRET");
  });

  it("uses the M1 model limit defaults", () => {
    const config = loadConfig(validEnv);

    expect(config.freeModel).toEqual({
      baseUrl: "",
      model: "",
      timeoutMs: 30000,
      maxOutputTokens: 512,
      maxInputCharacters: 2000,
      freeDailyLimit: 6000,
      userCooldownMs: 3000
    });
  });

  it("accepts a complete model endpoint and optional API key", () => {
    const config = loadConfig({
      ...validEnv,
      FREE_MODEL_BASE_URL: "https://model.example/v1",
      FREE_MODEL_NAME: "qwen3",
      FREE_MODEL_API_KEY: "test-key",
      FREE_MODEL_TIMEOUT_MS: "12000",
      FREE_TOKEN_LIMIT: "9000",
      FREE_MAX_INPUT_CHARS: "2500",
      FREE_MAX_OUTPUT_TOKENS: "768",
      FREE_USER_COOLDOWN_MS: "5000"
    });

    expect(config.freeModel).toEqual({
      baseUrl: "https://model.example/v1",
      model: "qwen3",
      apiKey: "test-key",
      timeoutMs: 12000,
      maxOutputTokens: 768,
      maxInputCharacters: 2500,
      freeDailyLimit: 9000,
      userCooldownMs: 5000
    });
  });

  it.each([
    "not-a-url",
    "ftp://model.example/v1",
    "https://"
  ])("rejects malformed model base URL %s", (baseUrl) => {
    expect(() => loadConfig({ ...validEnv, FREE_MODEL_BASE_URL: baseUrl, FREE_MODEL_NAME: "qwen3" })).toThrow(
      "FREE_MODEL_BASE_URL"
    );
  });

  it.each([
    ["FREE_MODEL_TIMEOUT_MS", "0"],
    ["FREE_TOKEN_LIMIT", "-1"],
    ["FREE_MAX_INPUT_CHARS", "0"],
    ["FREE_MAX_OUTPUT_TOKENS", "-1"],
    ["FREE_USER_COOLDOWN_MS", "0"]
  ])("rejects non-positive %s", (name, value) => {
    expect(() => loadConfig({ ...validEnv, [name]: value })).toThrow(name);
  });

  it.each([
    { FREE_MODEL_BASE_URL: "https://model.example/v1" },
    { FREE_MODEL_NAME: "qwen3" }
  ])("rejects incomplete model endpoint configuration", (modelEnv) => {
    expect(() => loadConfig({ ...validEnv, ...modelEnv })).toThrow("FREE_MODEL");
  });

  it("uses open local defaults and parses explicit external beta switches", () => {
    expect(loadBetaConfig({})).toMatchObject({ registrationEnabled: true, requireInviteCode: false, allowMockFallback: true });
    expect(loadBetaConfig({
      BETA_REGISTRATION_ENABLED: "false",
      BETA_REQUIRE_INVITE_CODE: "true",
      BETA_REQUIRE_ADULT: "true",
      BETA_GENERATION_ENABLED: "false",
      BETA_ALLOW_MOCK_FALLBACK: "false",
      BETA_TOKEN_MODE_ENABLED: "false",
      BETA_APPS_ENABLED: "false",
      BETA_FEEDBACK_ENABLED: "true",
      BETA_PROJECT_TOKEN_LIMIT: "20000000"
    })).toMatchObject({ registrationEnabled: false, requireInviteCode: true, requireAdult: true, generationEnabled: false, allowMockFallback: false, tokenModeEnabled: false, appsEnabled: false, feedbackEnabled: true, projectTokenLimit: 20_000_000 });
  });
});
