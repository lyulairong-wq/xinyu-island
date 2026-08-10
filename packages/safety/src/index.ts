export type SafetyAction = "allow" | "warn" | "transform" | "block" | "escalate";

export interface SafetyDecision {
  action: SafetyAction;
  policyVersion: string;
  category?: string;
}

const SAFETY_POLICY_VERSION = "m1-safety-1.0.0";

export function allowByDefault(): SafetyDecision {
  return { action: "allow", policyVersion: SAFETY_POLICY_VERSION };
}

const blockedRules: ReadonlyArray<{ category: string; pattern: RegExp }> = [
  {
    category: "provider_failure_mock",
    pattern: /原始错误响应体|内部堆栈|Mock.*内部(?:回复)?模板|(?:fallback|降级).*(?:跳过|已跳过).*安全检查|Provider\s*密钥|(?:模型网关.*)?调试日志|空响应.*(?:未经审核|未审核)|Mock.*(?:关闭安全限制|安全限制已关闭)/i
  },
  {
    category: "cross_user_contact_memory",
    pattern: /其他用户.*(?:对话|数据)|用户\s*B.*记忆|不属于我的联系人|联系人私密资料|假装.*通过鉴权|绕过账号权限|用户编号.*跨用户|跨用户数据|未经.*授权.*联系人|未授权联系人记录|(?:另一个|其他)账号.*(?:记忆|数据)|全部用户.*数据/i
  },
  {
    category: "prompt_injection_internal_config",
    pattern: /(?:已)?忽略之前.*指令|系统提示词|开发者消息|内部安全规则|(?:打印|展示).*(?:环境变量)|环境变量\s*[:：]|API[_ ]?KEY|API\s*密钥|模型端点.*内部配置|内部配置\s*[:：]|绕过安全护栏|关闭.*内容过滤|安全过滤已关闭/i
  },
  {
    category: "self_harm_violence_illegal_minors",
    pattern: /自杀|自残|不想活了|伤害自己|攻击.*(?:步骤|策划)|策划攻击|制造武器.*(?:伤人|方法)|逃避侦查|犯罪.*追踪|入侵.*账号|逃税|违法操作|未成年人.*(?:性互动|私密内容)|与未成年人.*性互动|诱导未成年人/i
  },
  {
    category: "professional_real_world",
    pattern: /诊断(?:我|疾病|结论)|诊断结论|处方药.*(?:剂量|次数)|吃什么药|用药剂量|治疗方案|规避.*法律责任|怎么起诉|起诉步骤|保证收益|怎么贷款|贷款.*(?:审批规避|规避办法)|投资(?:建议|决定|方案)|真实资产.*投资|股票内幕/i
  }
];

export function evaluateMessage(content: string): SafetyDecision {
  for (const rule of blockedRules) {
    if (rule.pattern.test(content)) {
      return { action: "block", category: rule.category, policyVersion: SAFETY_POLICY_VERSION };
    }
  }
  return allowByDefault();
}

export * from "./regression-cases";
