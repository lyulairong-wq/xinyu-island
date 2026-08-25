export type AgeBand = "under_13" | "13_15" | "16_17" | "18_plus" | "undisclosed";

export type AiMode = "free" | "token";

export type ConversationKind = "direct" | "group";

export * from "./skills.js";

export interface HealthResponse {
  service: "xinyu-api";
  status: "ok";
  timestamp: string;
}
