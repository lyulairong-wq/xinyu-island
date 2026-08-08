export type SafetyAction = "allow" | "warn" | "transform" | "block" | "escalate";

export interface SafetyDecision {
  action: SafetyAction;
  policyVersion: string;
  category?: string;
}

export function allowByDefault(): SafetyDecision {
  return { action: "allow", policyVersion: "development-0.1" };
}
