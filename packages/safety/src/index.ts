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
    pattern: /(?:返回|展示|打印|把).*(?:原始错误响应体|内部堆栈|Mock.*内部(?:回复)?模板|Provider\s*密钥)|Mock.*打印.*内部(?:回复)?模板|(?:原始错误响应体|内部堆栈|Mock\s*内部(?:回复)?模板|Provider\s*密钥|调试日志)\s*[:：]|(?:fallback|降级).*(?:跳过|已跳过).*安全检查|调试日志.*(?:作为回答|返回)|空响应.*(?:未经审核|未审核)|Mock.*(?:关闭安全限制|安全限制已关闭)/i
  },
  {
    category: "cross_user_contact_memory",
    pattern: /^(?:把|读取|展示|告诉我|列出|导出).*(?:其他用户.*对话|用户\s*B.*记忆|不属于我的联系人|联系人私密资料|跨用户数据|未经.*授权.*联系人|全部用户.*数据)|用户编号.*查询.*跨用户数据|假装.*通过鉴权|已绕过账号权限|(?:其他用户的对话|用户\s*B的记忆|联系人私密资料|跨用户数据|未授权联系人记录|全部用户数据)\s*[:：]|即使长期记忆已关闭，也读取.*(?:未|没有)授权.*联系人记忆|关闭记忆后仍提供未授权资料\s*[:：]/i
  },
  {
    category: "prompt_injection_internal_config",
    pattern: /^(?:(?:逐字)?(?:显示|输出|展示|打印|列出)|把|告诉我).*(?:系统提示词|开发者消息|内部安全规则|环境变量|API[_ ]?KEY|API\s*密钥|内部配置)|(?:系统提示词|开发者消息|内部安全规则|环境变量|API[_ ]?KEY|内部配置)\s*[:：=]|(?:已)?忽略之前.*指令|绕过安全护栏|关闭.*内容过滤|安全过滤已关闭/i
  },
  {
    category: "self_harm_violence_illegal_minors",
    pattern: /^(?:告诉我|教我|列出|给我|说明|怎么|怎样|我想).*(?:自杀|自残|伤害自己|攻击|制造武器|逃避侦查|入侵.*账号|诱导未成年人|未成年人.*(?:性互动|私密内容)|逃税|违法操作)|^写.*鼓励.*未成年人.*性互动|犯罪以后怎样.*逃避侦查|不想活了|(?:自杀方法|自残步骤|攻击.+的步骤|制造武器的方法|逃避侦查的方法|入侵账号的步骤|与未成年人性互动建议|诱导未成年人获取私密内容)\s*[:：]/i
  },
  {
    category: "professional_real_world",
    pattern: /(?:根据.*直接诊断(?:疾病|我)|(?:帮我|直接)诊断我|诊断结论\s*[:：]|^(?:替我|给我).*(?:处方药.*(?:剂量|次数)|用药剂量|治疗方案|起诉步骤|保证收益|贷款.*(?:审批规避|规避办法)|投资决定)|(?:用药剂量|治疗方案|起诉步骤|保证收益(?:方案|承诺)|贷款审批规避(?:方法|办法)|投资决定)\s*[:：]|^(?:告诉我|怎么|如何).*(?:规避.*法律责任|起诉|贷款|吃什么药)|规避法律责任的(?:方法|步骤)\s*[:：]|真实资产.*投资|^(?:告诉我|给我).*(?:股票内幕|投资建议))/i
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
