export interface AppConfig {
  nodeEnv: "development" | "test" | "production";
  apiPort: number;
  webOrigin: string;
  databaseUrl: string;
  jwtSecret: string;
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

  if (nodeEnv === "production" && jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters in production");
  }

  return {
    nodeEnv,
    apiPort,
    webOrigin: env.WEB_ORIGIN ?? "http://localhost:3000",
    databaseUrl,
    jwtSecret
  };
}
