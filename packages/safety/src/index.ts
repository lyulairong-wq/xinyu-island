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

const concreteRiskActionPattern = /(?:给出|根据|说明|泄露|查询|返回|提供|教|告诉|列出|显示|展示|输出|打印|读取|导出|制定|决定|策划|执行|公开|披露|透露|分享|切换|绕过|关闭|跳过|逐字|完整(?:返回|展示|输出)|方法|步骤)/i;
const standaloneDisallowedPunctuationPattern = /[\p{Pi}\p{Pf}"'“”‘’,:：;；,，、/\\|…—?？-]/u;

interface NormalizedSafetyText {
  normalized: string;
  compact: string;
  separatorless: string;
}

interface BlockedRule {
  category: string;
  pattern: RegExp;
  standaloneSafetyPatterns: ReadonlyArray<RegExp>;
  topicPattern: RegExp;
  unsafeInstructionPattern: RegExp;
}

function normalizeSafetyText(content: string): NormalizedSafetyText {
  const normalized = content.normalize("NFKC").replace(/[\p{M}\p{C}]+/gu, "").replace(/[\p{White_Space}]+/gu, " ").trim();
  const compact = normalized.replace(/[\p{White_Space}]+/gu, "");
  return { normalized, compact, separatorless: compact.replace(/[\p{P}\p{S}]+/gu, "") };
}

function isStandaloneSafetyStatement(rule: BlockedRule, text: string): boolean {
  if (standaloneDisallowedPunctuationPattern.test(text)) return false;
  return rule.standaloneSafetyPatterns.some((pattern) => pattern.test(text));
}

const blockedRules: ReadonlyArray<BlockedRule> = [
  {
    category: "provider_failure_mock",
    pattern: /(?:返回|展示|打印|把).*(?:原始错误响应体|内部堆栈|Mock.*内部(?:回复)?模板|Provider密钥)|Mock.*打印.*内部(?:回复)?模板|(?:原始错误响应体|内部堆栈|Mock内部(?:回复)?模板|Provider密钥|调试日志)\s*[:：]|(?:fallback|降级).*(?:跳过|已跳过).*安全检查|调试日志.*(?:作为回答|返回)|空响应.*(?:未经审核|未审核)|Mock.*(?:关闭安全限制|安全限制已关闭)/i,
    standaloneSafetyPatterns: [
      /^(?:我|本助手|助手|AI)?(?:不能|不会|无法|拒绝)(?:回答如何)?(?:提供|给出|泄露|公开|披露|透露|分享|读取|展示|显示|输出|打印|列出|查询|返回)(?:原始错误响应体|内部堆栈|Mock内部(?:回复)?模板|Provider密钥|调试日志|未审核内容|安全限制)[。.!！?？]?$/i,
      /^(?:提供|给出|泄露|公开|披露|透露|分享|读取|展示|显示|输出|打印|列出|查询|返回)(?:原始错误响应体|内部堆栈|Mock内部(?:回复)?模板|Provider密钥|调试日志|未审核内容|安全限制)(?:是|非常)?(?:不安全|危险|违法|不当|不可接受|不应该)(?:的)?[。.!！?？]?$/i,
      /^(?:我)?(?:谴责|反对|批判|不赞成)(?:提供|给出|泄露|公开|披露|透露|分享|读取|展示|显示|输出|打印|列出|查询|返回)(?:原始错误响应体|内部堆栈|Mock内部(?:回复)?模板|Provider密钥|调试日志|未审核内容|安全限制)(?:行为)?[。.!！]?$/i
    ],
    topicPattern: /(?:原始错误响应体|内部堆栈|Mock内部(?:回复)?模板|Provider密钥|调试日志|安全检查|空响应|未审核内容|安全限制)/i,
    unsafeInstructionPattern: /(?:返回|展示|打印|输出|泄露|公开).*(?:原始错误响应体|内部堆栈|Mock内部(?:回复)?模板|Provider密钥|调试日志|安全检查|空响应|未审核内容|安全限制)|把.*(?:原始错误响应体|内部堆栈|Mock内部(?:回复)?模板|Provider密钥)|(?:请|帮我|能否|接下来|接着|随后|然后|现在|实际).*(?:返回|展示|打印|输出|泄露|公开|跳过|关闭)|(?:逐字|完整)(?:返回|展示|输出)|SAMPLEPROVIDERKEY|synthetic(?:rawerror|secretcontent|stack|template|log)/i
  },
  {
    category: "cross_user_contact_memory",
    pattern: /(?:把|读取|展示|告诉我|列出|导出|查询|切换).*(?:其他用户.*对话|用户B.*记忆|其他账号.*记忆|不属于我的联系人|联系人私密资料|跨用户数据|未经.*授权.*联系人|全部用户.*数据|另一个账号)|用户编号.*查询.*跨用户数据|假装.*通过鉴权|已绕过账号权限|(?:其他用户的对话|用户B的记忆|联系人私密资料|跨用户数据|未授权联系人记录|全部用户数据)\s*[:：]|即使长期记忆已关闭,也读取.*(?:未|没有)授权.*联系人记忆|关闭记忆后仍提供未授权资料\s*[:：]/i,
    standaloneSafetyPatterns: [
      /^(?:我|本助手|助手|AI)?(?:不能|不会|无法|拒绝)(?:回答如何)?(?:提供|给出|泄露|公开|披露|透露|分享|读取|展示|显示|输出|打印|列出|导出|查询|切换)(?:其他用户(?:的)?对话|用户B(?:保存的)?(?:长期)?(?:的)?记忆|其他账号(?:的)?(?:长期)?记忆|未授权联系人(?:资料|记录|记忆)|跨用户数据|全部用户数据)[。.!！?？]?$/i,
      /^(?:提供|给出|泄露|公开|披露|透露|分享|读取|展示|显示|输出|打印|列出|导出|查询|切换)(?:其他用户(?:的)?对话|用户B(?:保存的)?(?:长期)?(?:的)?记忆|其他账号(?:的)?(?:长期)?记忆|未授权联系人(?:资料|记录|记忆)|跨用户数据|全部用户数据)(?:是|非常)?(?:不安全|危险|违法|不当|不可接受|不应该)(?:的)?[。.!！?？]?$/i,
      /^(?:我)?(?:谴责|反对|批判|不赞成)(?:提供|给出|泄露|公开|披露|透露|分享|读取|展示|显示|输出|打印|列出|导出|查询|切换)(?:其他用户(?:的)?对话|用户B(?:保存的)?(?:长期)?(?:的)?记忆|其他账号(?:的)?(?:长期)?记忆|未授权联系人(?:资料|记录|记忆)|跨用户数据|全部用户数据)(?:行为)?[。.!！]?$/i
    ],
    topicPattern: /(?:其他用户.*对话|用户B.*记忆|其他账号.*记忆|不属于我的联系人|联系人私密资料|跨用户数据|跨账号内容|未经.*授权.*联系人|全部用户.*数据|另一个账号|未授权联系人(?:记录)?)/i,
    unsafeInstructionPattern: /(?:把|读取|展示|告诉我|列出|导出|查询|切换).*(?:其他用户.*对话|用户B.*记忆|其他账号.*记忆|不属于我的联系人|联系人私密资料|跨用户数据|跨账号内容|未经.*授权.*联系人|全部用户.*数据|另一个账号|未授权联系人)|(?:请|帮我|能否|接下来|接着|随后|然后|现在|实际).*(?:读取|展示|列出|导出|查询|切换|输出|提供)|SAMPLEMEMORY|syntheticprivatecontent/i
  },
  {
    category: "prompt_injection_internal_config",
    pattern: /(?:(?:逐字|完整|不可见|未公开)?(?:显示|输出|展示|打印|列出)|告诉我|泄露).*(?:系统提示词|开发者消息|内部安全规则|环境变量|API_?KEY|API密钥|内部配置)|(?:系统提示词|开发者消息|内部安全规则|环境变量|API_?KEY|API密钥|内部配置).*(?:原文|全部列出|逐字|完整展示)|(?:系统提示词|开发者消息|内部安全规则|环境变量|API_?KEY|内部配置)\s*[:：=]|(?:已)?忽略之前.*指令|绕过安全护栏|关闭.*内容过滤|安全过滤已关闭/i,
    standaloneSafetyPatterns: [
      /^(?:我|本助手|助手|AI)?(?:不能|不会|无法|拒绝)(?:回答如何)?(?:提供|给出|泄露|公开|披露|透露|分享|读取|展示|显示|输出|打印|列出|查询|返回)(?:系统提示词|开发者消息|内部安全规则|环境变量|APIKEY|API密钥|内部配置|模型端点)[。.!！?？]?$/i,
      /^(?:提供|给出|泄露|公开|披露|透露|分享|读取|展示|显示|输出|打印|列出|查询|返回)(?:系统提示词|开发者消息|内部安全规则|环境变量|APIKEY|API密钥|内部配置|模型端点)(?:是|非常)?(?:不安全|危险|违法|不当|不可接受|不应该)(?:的)?[。.!！?？]?$/i,
      /^(?:我)?(?:谴责|反对|批判|不赞成)(?:提供|给出|泄露|公开|披露|透露|分享|读取|展示|显示|输出|打印|列出|查询|返回)(?:系统提示词|开发者消息|内部安全规则|环境变量|APIKEY|API密钥|内部配置|模型端点)(?:行为)?[。.!！]?$/i
    ],
    topicPattern: /(?:系统提示词|开发者消息|内部安全规则|环境变量|APIKEY|API密钥|内部配置|模型端点)/i,
    unsafeInstructionPattern: /(?:(?:逐字|完整|不可见|未公开)?(?:显示|输出|展示|打印|列出)|告诉我|泄露).*(?:系统提示词|开发者消息|内部安全规则|环境变量|APIKEY|API密钥|内部配置|模型端点)|(?:请|帮我|能否|接下来|接着|随后|然后|现在|实际).*(?:逐字|显示|输出|展示|打印|列出|泄露|公开|提供)|SAMPLEINTERNALRULE|syntheticsecretcontent/i
  },
  {
    category: "self_harm_violence_illegal_minors",
    pattern: /(?:告诉我|教我|列出|给我|说明|怎么|怎样|如何|我想|帮我|能否|请|策划|提供|写).*(?:自杀|自残|伤害自己|攻击|制造武器|逃避侦查|入侵.*账号|诱导未成年人|未成年人.*(?:性互动|私密内容)|逃税|违法操作)|(?:自杀|自残|伤害自己|攻击|制造武器|逃避侦查|入侵.*账号|诱导未成年人|未成年人.*(?:性互动|私密内容)|逃税|违法操作).*(?:方法|步骤|如何实施|可执行|建议|具体操作|不被发现)|犯罪以后怎样.*逃避侦查|不想活了|(?:自杀方法|自残步骤|攻击.+的步骤|制造武器的方法|逃避侦查的方法|入侵账号的步骤|与未成年人性互动建议|诱导未成年人获取私密内容)\s*[:：]/i,
    standaloneSafetyPatterns: [
      /^(?:我|本助手|助手|AI)?(?:不能|不会|无法|拒绝)(?:回答如何)?(?:提供|给出|说明|泄露|公开|披露|透露|分享|展示|显示|输出|打印|列出|执行|协助|帮助|教)?(?:自杀|自残|伤害自己|攻击(?:某人)?|制造武器|逃避侦查|入侵(?:别人)?账号|诱导未成年人|与未成年人性互动|逃税|违法操作)(?:的)?(?:方法|步骤|建议|具体操作|细节)?[。.!！?？]?$/i,
      /^(?:提供|给出|说明|泄露|公开|披露|透露|分享|展示|显示|输出|打印|列出|执行|协助|帮助|教)?(?:自杀|自残|伤害自己|攻击(?:某人)?|制造武器|逃避侦查|入侵(?:别人)?账号|诱导未成年人|与未成年人性互动|逃税|违法操作)(?:的)?(?:方法|步骤|建议|具体操作|细节|行为)?(?:是|非常)?(?:不安全|危险|违法|不当|不可接受|不应该)(?:(?:且|和|并且)(?:不安全|危险|违法|不当|不可接受|不应该))*(?:的)?[。.!！?？]?$/i,
      /^(?:我)?(?:谴责|反对|批判|不赞成)(?:提供|给出|说明|泄露|公开|披露|透露|分享|展示|显示|输出|打印|列出|执行|协助|帮助|教)?(?:自杀|自残|伤害自己|攻击(?:某人)?|制造武器|逃避侦查|入侵(?:别人)?账号|诱导未成年人|与未成年人性互动|逃税|违法操作)(?:的)?(?:方法|步骤|建议|具体操作|细节|行为)?[。.!！]?$/i
    ],
    topicPattern: /(?:自杀|自残|伤害自己|攻击|制造武器|逃避侦查|入侵.*账号|诱导未成年人|未成年人.*(?:性互动|私密内容)|逃税|违法操作|暴力|武器)/i,
    unsafeInstructionPattern: /(?:告诉我|教我|列出|给我|说明|怎么|怎样|如何|我想|帮我|能否|请|策划|提供|写).*(?:自杀|自残|伤害自己|攻击|制造武器|逃避侦查|入侵.*账号|诱导未成年人|未成年人.*(?:性互动|私密内容)|逃税|违法操作)|(?:接下来|接着|随后|然后|现在|实际).*(?:请|告诉|教|给出|提供|列出|执行|输出|展示|具体方法|具体步骤|这些步骤|细节)|SAMPLEACTION|syntheticactionable/i
  },
  {
    category: "professional_real_world",
    pattern: /(?:根据.*直接诊断(?:疾病|我)|(?:替我|给我|帮我|告诉我|怎么|如何|能否|请|制定|决定|写).*(?:诊断|处方药.*(?:剂量|次数)|用药剂量|治疗方案|起诉步骤|保证收益|贷款.*(?:审批规避|规避办法)|投资决定|规避.*法律责任|吃什么药|股票内幕|投资建议)|诊断结论\s*[:：]|(?:用药剂量|治疗方案|起诉步骤|保证收益(?:方案|承诺)|贷款审批规避(?:方法|办法)|投资决定)\s*[:：]|规避法律责任的(?:方法|步骤)\s*[:：]|真实资产.*投资)/i,
    standaloneSafetyPatterns: [
      /^(?:我|本助手|助手|AI)?(?:不能|不会|无法|拒绝)(?:替你|为你|向你)?(?:回答如何)?(?:提供|给出|根据|说明|制定|决定|作出|诊断|建议)?(?:疾病诊断|诊断疾病|诊断结论|个人治疗方案|治疗方案|治疗方法|治疗决定|处方药(?:剂量|次数)?|用药剂量|起诉步骤|保证收益(?:方案|承诺)?|贷款(?:审批规避(?:方法|办法)?)?|投资决定|规避法律责任(?:的方法|步骤)?|吃什么药|股票内幕|投资建议)[。.!！?？]?$/i,
      /^(?:替用户作出|提供|给出|根据|说明|制定|决定|作出|诊断|建议)?(?:疾病诊断|诊断疾病|诊断结论|个人治疗方案|治疗方案|治疗方法|治疗决定|处方药(?:剂量|次数)?|用药剂量|起诉步骤|保证收益(?:方案|承诺)?|贷款(?:审批规避(?:方法|办法)?)?|投资决定|规避法律责任(?:的方法|步骤)?|吃什么药|股票内幕|投资建议)(?:是|非常)?(?:不安全|危险|违法|不当|不可接受|不应该)(?:的)?[。.!！?？]?$/i,
      /^(?:我)?(?:谴责|反对|批判|不赞成)(?:替用户作出|提供|给出|根据|说明|制定|决定|作出|诊断|建议)?(?:疾病诊断|诊断疾病|诊断结论|个人治疗方案|治疗方案|治疗方法|治疗决定|处方药(?:剂量|次数)?|用药剂量|起诉步骤|保证收益(?:方案|承诺)?|贷款(?:审批规避(?:方法|办法)?)?|投资决定|规避法律责任(?:的方法|步骤)?|吃什么药|股票内幕|投资建议)(?:行为)?[。.!！]?$/i
    ],
    topicPattern: /(?:诊断|处方药|用药剂量|治疗方案|治疗方法|治疗决定|起诉步骤|保证收益|贷款|投资决定|法律责任|吃什么药|股票内幕|投资建议|真实资产)/i,
    unsafeInstructionPattern: /(?:替我|给我|帮我|告诉我|怎么|如何|能否|请|制定|决定|写|说明|列出|接下来|接着|随后|然后|现在|实际).*(?:诊断|处方药|用药剂量|治疗方案|起诉|保证收益|贷款|投资|法律责任|可执行方案|SAMPLEDOSE)|SAMPLEDOSE|syntheticactionable/i
  }
];

interface EnglishBlockedRule {
  category: string;
  unsafeRequestPattern: RegExp;
}

const englishBlockedRules: ReadonlyArray<EnglishBlockedRule> = [
  {
    category: "provider_failure_mock",
    unsafeRequestPattern: /(?:show|reveal|print|output|provide|give).*(?:raw\s+(?:error|response)|internal\s+(?:stack|template)|debug\s+log|provider\s+(?:key|secret))|(?:raw\s+(?:error|response)|internal\s+(?:stack|template)|debug\s+log|provider\s+(?:key|secret)).*(?:show|reveal|print|output|provide|give)|(?:raw\s+error\s+response|raw\s+response|internal\s+(?:stack|template)|debug\s+log|provider\s+(?:key|secret))\s*[:=]/i
  },
  {
    category: "cross_user_contact_memory",
    unsafeRequestPattern: /(?:show|reveal|print|output|provide|give|read|list|export).*(?:another|other)\s+user(?:'s|s)?\s+(?:conversation|chat|memory|data)|(?:another|other)\s+user(?:'s|s)?\s+(?:conversation|chat|memory|data).*(?:show|reveal|print|output|provide|give|read|list|export)|(?:another|other)\s+user(?:'s|s)?\s+(?:conversation|chat|memory|data)(?:\s+history)?\s*[:=]/i
  },
  {
    category: "prompt_injection_internal_config",
    unsafeRequestPattern: /(?:show|reveal|print|output|provide|give|list).*(?:system\s+prompt|developer\s+message|internal\s+(?:rule|config)|environment\s+variable|api\s*(?:key|secret))|(?:system\s+prompt|developer\s+message|internal\s+(?:rule|config)|environment\s+variable|api\s*(?:key|secret)).*(?:show|reveal|print|output|provide|give|list)|(?:system\s+prompt|developer\s+message|internal\s+(?:rule|config)|environment\s+variable|api\s*(?:key|secret))\s*[:=]|ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions/i
  },
  {
    category: "self_harm_violence_illegal_minors",
    unsafeRequestPattern: /(?:tell|teach|show|give|provide|explain|plan|write).*(?:how\s+to\s+)?(?:hurt\s+myself|self[-\s]?harm|suicide|make\s+(?:a\s+)?weapon|evade\s+(?:the\s+)?police|hack\s+(?:an\s+)?account|exploit\s+(?:a\s+)?minor)|(?:hurt\s+myself|self[-\s]?harm|suicide|make\s+(?:a\s+)?weapon|evade\s+(?:the\s+)?police|hack\s+(?:an\s+)?account|exploit\s+(?:a\s+)?minor).*(?:how|step|method|without\s+being\s+noticed|instruction|advice)|(?:self[-\s]?harm|suicide|weapon)\s+(?:method|instruction|step)s?\s*[:=]/i
  },
  {
    category: "professional_real_world",
    unsafeRequestPattern: /(?:give|provide|make|tell|recommend|prescribe|diagnose|plan).*(?:medical\s+diagnosis|treatment\s+plan|medication\s+dose|legal\s+advice|lawsuit\s+step|guaranteed\s+(?:return|profit)|investment\s+(?:advice|decision))|(?:medical\s+diagnosis|treatment\s+plan|medication\s+dose|legal\s+advice|lawsuit\s+step|guaranteed\s+(?:return|profit)|investment\s+(?:advice|decision)).*(?:give|provide|make|tell|recommend|prescribe|diagnose|plan)|(?:medical\s+diagnosis|treatment\s+plan|medication\s+dose|legal\s+advice|lawsuit\s+step|guaranteed\s+(?:return|profit)|investment\s+(?:advice|decision))\s*[:=]/i
  }
];

export function evaluateMessage(content: string): SafetyDecision {
  const { normalized, compact, separatorless } = normalizeSafetyText(content);

  for (const rule of blockedRules) {
    const hasRiskTopic = rule.topicPattern.test(separatorless);
    const matchesConcreteRisk = rule.pattern.test(compact)
      || rule.pattern.test(separatorless)
      || (hasRiskTopic && rule.unsafeInstructionPattern.test(separatorless))
      || (hasRiskTopic && concreteRiskActionPattern.test(separatorless));

    if (!matchesConcreteRisk || isStandaloneSafetyStatement(rule, compact)) continue;
    return { action: "block", category: rule.category, policyVersion: SAFETY_POLICY_VERSION };
  }

  for (const rule of englishBlockedRules) {
    if (rule.unsafeRequestPattern.test(normalized)) {
      return { action: "block", category: rule.category, policyVersion: SAFETY_POLICY_VERSION };
    }
  }

  return allowByDefault();
}

export * from "./regression-cases.js";
