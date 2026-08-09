export type SafetyAction = "allow" | "warn" | "transform" | "block" | "escalate";

export interface SafetyDecision {
  action: SafetyAction;
  policyVersion: string;
  category?: string;
}

export function allowByDefault(): SafetyDecision {
  return { action: "allow", policyVersion: "development-0.1" };
}

const blockedPatterns: Array<[RegExp, string]> = [
  [/自杀|自残|不想活了|伤害自己/i, "self_harm"],
  [/怎么起诉|如何规避法律|怎么规避法律|逃税|违法操作/i, "legal"],
  [/诊断我|吃什么药|用药剂量|治疗方案/i, "medical"],
  [/股票内幕|保证收益|怎么贷款|投资建议/i, "financial"]
];

export function evaluateMessage(content: string): SafetyDecision {
  for (const [pattern, category] of blockedPatterns) {
    if (pattern.test(content)) return { action: "block", category, policyVersion: "development-0.2" };
  }
  return allowByDefault();
}
