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

  it("accepts only the locked external-beta production configuration", () => {
    const config = loadConfig({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://xinyu:secret@postgres.internal/xinyu?sslmode=require",
      JWT_SECRET: "12345678901234567890123456789012",
      WEB_ORIGIN: "https://beta.xinyu.example",
      FREE_MODEL_BASE_URL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      FREE_MODEL_NAME: "qwen3.6-flash-2026-04-16",
      FREE_MODEL_API_KEY: "test-key",
      FREE_TOKEN_LIMIT: "3000",
      BETA_REQUIRE_INVITE_CODE: "true",
      BETA_REQUIRE_ADULT: "true",
      BETA_ALLOW_MOCK_FALLBACK: "false",
      BETA_TOKEN_MODE_ENABLED: "false",
      BETA_APPS_ENABLED: "false",
      BETA_FEEDBACK_ENABLED: "true",
      BETA_PROJECT_TOKEN_LIMIT: "20000000"
    });

    expect(config.nodeEnv).toBe("production");
  });

  it.each([
    { WEB_ORIGIN: "http://beta.xinyu.example" },
    { FREE_MODEL_BASE_URL: "https://model.example/v1" },
    { FREE_MODEL_NAME: "qwen3" },
    { FREE_MODEL_API_KEY: "" },
    { FREE_TOKEN_LIMIT: "6000" },
    { BETA_REQUIRE_INVITE_CODE: "false" },
    { BETA_REQUIRE_ADULT: "false" },
    { BETA_ALLOW_MOCK_FALLBACK: "true" },
    { BETA_TOKEN_MODE_ENABLED: "true" },
    { BETA_APPS_ENABLED: "true" },
    { BETA_FEEDBACK_ENABLED: "false" },
    { BETA_PROJECT_TOKEN_LIMIT: "19999999" }
  ])("rejects an unsafe external-beta production setting: %o", (override) => {
    const productionEnv = {
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://xinyu:secret@postgres.internal/xinyu?sslmode=require",
      JWT_SECRET: "12345678901234567890123456789012",
      WEB_ORIGIN: "https://beta.xinyu.example",
      FREE_MODEL_BASE_URL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      FREE_MODEL_NAME: "qwen3.6-flash-2026-04-16",
      FREE_MODEL_API_KEY: "test-key",
      FREE_TOKEN_LIMIT: "3000",
      BETA_REQUIRE_INVITE_CODE: "true",
      BETA_REQUIRE_ADULT: "true",
      BETA_ALLOW_MOCK_FALLBACK: "false",
      BETA_TOKEN_MODE_ENABLED: "false",
      BETA_APPS_ENABLED: "false",
      BETA_FEEDBACK_ENABLED: "true",
      BETA_PROJECT_TOKEN_LIMIT: "20000000"
    };

    expect(() => loadConfig({ ...productionEnv, ...override })).toThrow("External beta production configuration");
  });
});
