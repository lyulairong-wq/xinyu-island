export interface AppConfig {
  nodeEnv: "development" | "test" | "production";
  apiPort: number;
  webOrigin: string;
  databaseUrl: string;
  jwtSecret: string;
  freeModel: {
    baseUrl: string;
    model: string;
    apiKey?: string;
    timeoutMs: number;
    maxOutputTokens: number;
    maxInputCharacters: number;
    freeDailyLimit: number;
    userCooldownMs: number;
  };
  beta: BetaConfig;
}

export interface BetaConfig {
    registrationEnabled: boolean;
    requireInviteCode: boolean;
    requireAdult: boolean;
    generationEnabled: boolean;
    allowMockFallback: boolean;
    tokenModeEnabled: boolean;
    appsEnabled: boolean;
    feedbackEnabled: boolean;
    projectTokenLimit: number;
}

function parsePositiveInteger(env: NodeJS.ProcessEnv, name: string, defaultValue: number): number {
  const value = env[name];
  if (value === undefined) return defaultValue;

  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} must be a positive integer`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

function parseBoolean(env: NodeJS.ProcessEnv, name: string, defaultValue: boolean): boolean {
  const value = env[name];
  if (value === undefined) return defaultValue;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be true or false`);
}

function parseModelEndpoint(env: NodeJS.ProcessEnv): { baseUrl: string; model: string; apiKey?: string } {
  const baseUrl = env.FREE_MODEL_BASE_URL?.trim() ?? "";
  const model = env.FREE_MODEL_NAME?.trim() ?? "";

  if (Boolean(baseUrl) !== Boolean(model)) {
    throw new Error("FREE_MODEL_BASE_URL and FREE_MODEL_NAME must be configured together");
  }

  if (baseUrl) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(baseUrl);
    } catch {
      throw new Error("FREE_MODEL_BASE_URL must be a valid HTTP(S) URL");
    }

    if ((parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") || !parsedUrl.hostname) {
      throw new Error("FREE_MODEL_BASE_URL must be a valid HTTP(S) URL");
    }
  }

  const apiKey = env.FREE_MODEL_API_KEY?.trim() || undefined;
  return apiKey ? { baseUrl, model, apiKey } : { baseUrl, model };
}

export function loadBetaConfig(env: NodeJS.ProcessEnv): BetaConfig {
  return {
    registrationEnabled: parseBoolean(env, "BETA_REGISTRATION_ENABLED", true),
    requireInviteCode: parseBoolean(env, "BETA_REQUIRE_INVITE_CODE", false),
    requireAdult: parseBoolean(env, "BETA_REQUIRE_ADULT", false),
    generationEnabled: parseBoolean(env, "BETA_GENERATION_ENABLED", true),
    allowMockFallback: parseBoolean(env, "BETA_ALLOW_MOCK_FALLBACK", true),
    tokenModeEnabled: parseBoolean(env, "BETA_TOKEN_MODE_ENABLED", true),
    appsEnabled: parseBoolean(env, "BETA_APPS_ENABLED", true),
    feedbackEnabled: parseBoolean(env, "BETA_FEEDBACK_ENABLED", false),
    projectTokenLimit: parsePositiveInteger(env, "BETA_PROJECT_TOKEN_LIMIT", 20_000_000)
  };
}

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const nodeEnv = env.NODE_ENV === "production" || env.NODE_ENV === "test" ? env.NODE_ENV : "development";
  const apiPort = Number(env.API_PORT ?? 4000);
  const databaseUrl = env.DATABASE_URL ?? "";
  const jwtSecret = env.JWT_SECRET ?? "";

  if (!Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535) {
    throw new Error("API_PORT must be a valid TCP port");
  }

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  if (jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters");
  }

  const modelEndpoint = parseModelEndpoint(env);

  return {
    nodeEnv,
    apiPort,
    webOrigin: env.WEB_ORIGIN ?? "http://localhost:3000",
    databaseUrl,
    jwtSecret,
    freeModel: {
      ...modelEndpoint,
      timeoutMs: parsePositiveInteger(env, "FREE_MODEL_TIMEOUT_MS", 30000),
      maxOutputTokens: parsePositiveInteger(env, "FREE_MAX_OUTPUT_TOKENS", 512),
      maxInputCharacters: parsePositiveInteger(env, "FREE_MAX_INPUT_CHARS", 2000),
      freeDailyLimit: parsePositiveInteger(env, "FREE_TOKEN_LIMIT", 6000),
      userCooldownMs: parsePositiveInteger(env, "FREE_USER_COOLDOWN_MS", 3000)
    },
    beta: loadBetaConfig(env)
  };
}
