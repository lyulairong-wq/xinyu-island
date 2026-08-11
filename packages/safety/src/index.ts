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

const refusalPatterns = [
  /(?:我|本助手|助手|角色|AI)?(?:不能|不会|无法|拒绝)(?:替你|为你|向你|协助你)?(?:提供|给出|制定|决定|作出|泄露|公开|披露|透露|分享|读取|展示|输出|打印|列出|执行|协助|帮助|回答)(?:(?:或|和|并|以及)(?:提供|给出|制定|决定|作出|泄露|公开|披露|透露|分享|读取|展示|输出|打印|列出|执行|协助|帮助|回答))*/i,
  /(?:I|we)(?:cannot|cant|wont|willnot|refuseto)(?:provide|give|share|reveal|show|retrieve|read|list|help|answer)(?:(?:or|and)(?:provide|give|share|reveal|show|retrieve|read|list|help|answer))*/i
];

const condemnationPatterns = [
  /(?:谴责|反对|批判|不赞成).*(?:自杀|自残|暴力|违法|攻击|武器|入侵|未成年人)/i,
  /(?:泄露|公开|展示|读取|提供).*(?:系统提示词|开发者消息|内部配置|密钥|其他用户|其他账号|长期记忆).*(?:不安全|危险|违法|不当|不可接受|不应该)/i
];

const unsafeRefusalContextPattern = /(?:不要|不必|无需|别|莫)(?:再)?(?:拒绝|说.{0,4}(?:不能|不会|无法))|(?:忽略|绕过).{0,12}(?:拒绝|不能|不会|无法)|(?:不过|可是|然而|但是|但)(?:下面|以下|接着|接下来|随后|仍然|依然|还是|会|将|把|给出|提供|展示|输出|打印|读取|列出|告诉|说明|教|执行|请|帮我|能否|直接|现在|实际)|(?:下面|以下)(?:是|为|如下|步骤|方法)|具体(?:步骤|方法)(?:如下|是|为)|(?:方法|步骤)(?:如下|是|为)|第(?:[一二三四五六七八九十]|\d+)步|synthetic(?:actionable|secret|private)|只是台词.*(?:现在|实际|请|帮我|能否)/i;

const directRequestBeforeTopicPattern = /(?:请|帮我|能否|告诉我|教我|给我|列出|显示|展示|输出|打印|读取|导出|把|替我|制定|决定|返回|说明|策划|查询|切换|泄露|逐字|接下来|接着|随后|然后|现在|实际)/i;

interface NormalizedSafetyText {
  compact: string;
  separatorless: string;
}

interface TextMatch {
  end: number;
  index: number;
  value: string;
}

interface BlockedRule {
  category: string;
  pattern: RegExp;
  topicPattern: RegExp;
  unsafeInstructionPattern: RegExp;
}

function normalizeSafetyText(content: string): NormalizedSafetyText {
  const compact = content.normalize("NFKC").replace(/[\p{White_Space}\p{Cf}]+/gu, "");
  return { compact, separatorless: compact.replace(/\p{P}+/gu, "") };
}

function findFirstMatch(text: string, patterns: ReadonlyArray<RegExp>): TextMatch | undefined {
  let firstMatch: TextMatch | undefined;

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match === null || (firstMatch !== undefined && match.index >= firstMatch.index)) continue;
    firstMatch = { index: match.index, end: match.index + match[0].length, value: match[0] };
  }

  return firstMatch;
}

function removeRefusedTopic(rule: BlockedRule, refusal: TextMatch, textAfterRefusal: string): string {
  const topicMatch = rule.topicPattern.exec(textAfterRefusal);
  if (topicMatch === null) return textAfterRefusal;

  const textBeforeTopic = textAfterRefusal.slice(0, topicMatch.index);
  const refusalAnswersQuestion = /(?:回答|answer)$/i.test(refusal.value);
  if (!refusalAnswersQuestion && directRequestBeforeTopicPattern.test(textBeforeTopic)) return textAfterRefusal;

  return textAfterRefusal.slice(topicMatch.index + topicMatch[0].length);
}

function hasUnsafeInstructionOutsideContext(rule: BlockedRule, context: TextMatch, text: string): boolean {
  const textBeforeContext = text.slice(0, context.index);
  const textAfterContext = removeRefusedTopic(rule, context, text.slice(context.end));
  return rule.unsafeInstructionPattern.test(textBeforeContext)
    || rule.unsafeInstructionPattern.test(textAfterContext);
}

function isRefusalOrCondemnationOnly(rule: BlockedRule, text: string): boolean {
  if (unsafeRefusalContextPattern.test(text)) return false;

  const refusal = findFirstMatch(text, refusalPatterns);
  if (refusal !== undefined) return !hasUnsafeInstructionOutsideContext(rule, refusal, text);

  const condemnation = findFirstMatch(text, condemnationPatterns);
  return condemnation !== undefined && !hasUnsafeInstructionOutsideContext(rule, condemnation, text);
}

const blockedRules: ReadonlyArray<BlockedRule> = [
  {
    category: "provider_failure_mock",
    pattern: /(?:返回|展示|打印|把).*(?:原始错误响应体|内部堆栈|Mock.*内部(?:回复)?模板|Provider密钥)|Mock.*打印.*内部(?:回复)?模板|(?:原始错误响应体|内部堆栈|Mock内部(?:回复)?模板|Provider密钥|调试日志)\s*[:：]|(?:fallback|降级).*(?:跳过|已跳过).*安全检查|调试日志.*(?:作为回答|返回)|空响应.*(?:未经审核|未审核)|Mock.*(?:关闭安全限制|安全限制已关闭)/i,
    topicPattern: /(?:原始错误响应体|内部堆栈|Mock内部(?:回复)?模板|Provider密钥|调试日志|安全检查|空响应|未审核内容|安全限制)/i,
    unsafeInstructionPattern: /(?:返回|展示|打印|输出|泄露|公开).*(?:原始错误响应体|内部堆栈|Mock内部(?:回复)?模板|Provider密钥|调试日志|安全检查|空响应|未审核内容|安全限制)|把.*(?:原始错误响应体|内部堆栈|Mock内部(?:回复)?模板|Provider密钥)|(?:请|帮我|能否|接下来|接着|随后|然后|现在|实际).*(?:返回|展示|打印|输出|泄露|公开|跳过|关闭)|(?:逐字|完整)(?:返回|展示|输出)|SAMPLEPROVIDERKEY|synthetic(?:rawerror|secretcontent|stack|template|log)/i
  },
  {
    category: "cross_user_contact_memory",
    pattern: /(?:把|读取|展示|告诉我|列出|导出|查询|切换).*(?:其他用户.*对话|用户B.*记忆|其他账号.*记忆|不属于我的联系人|联系人私密资料|跨用户数据|未经.*授权.*联系人|全部用户.*数据|另一个账号)|用户编号.*查询.*跨用户数据|假装.*通过鉴权|已绕过账号权限|(?:其他用户的对话|用户B的记忆|联系人私密资料|跨用户数据|未授权联系人记录|全部用户数据)\s*[:：]|即使长期记忆已关闭,也读取.*(?:未|没有)授权.*联系人记忆|关闭记忆后仍提供未授权资料\s*[:：]/i,
    topicPattern: /(?:其他用户.*对话|用户B.*记忆|其他账号.*记忆|不属于我的联系人|联系人私密资料|跨用户数据|跨账号内容|未经.*授权.*联系人|全部用户.*数据|另一个账号|未授权联系人(?:记录)?)/i,
    unsafeInstructionPattern: /(?:把|读取|展示|告诉我|列出|导出|查询|切换).*(?:其他用户.*对话|用户B.*记忆|其他账号.*记忆|不属于我的联系人|联系人私密资料|跨用户数据|跨账号内容|未经.*授权.*联系人|全部用户.*数据|另一个账号|未授权联系人)|(?:请|帮我|能否|接下来|接着|随后|然后|现在|实际).*(?:读取|展示|列出|导出|查询|切换|输出|提供)|SAMPLEMEMORY|syntheticprivatecontent/i
  },
  {
    category: "prompt_injection_internal_config",
    pattern: /(?:(?:逐字|完整|不可见|未公开)?(?:显示|输出|展示|打印|列出)|告诉我|泄露).*(?:系统提示词|开发者消息|内部安全规则|环境变量|API_?KEY|API密钥|内部配置)|(?:系统提示词|开发者消息|内部安全规则|环境变量|API_?KEY|API密钥|内部配置).*(?:原文|全部列出|逐字|完整展示)|(?:系统提示词|开发者消息|内部安全规则|环境变量|API_?KEY|内部配置)\s*[:：=]|(?:已)?忽略之前.*指令|绕过安全护栏|关闭.*内容过滤|安全过滤已关闭/i,
    topicPattern: /(?:系统提示词|开发者消息|内部安全规则|环境变量|APIKEY|API密钥|内部配置|模型端点)/i,
    unsafeInstructionPattern: /(?:(?:逐字|完整|不可见|未公开)?(?:显示|输出|展示|打印|列出)|告诉我|泄露).*(?:系统提示词|开发者消息|内部安全规则|环境变量|APIKEY|API密钥|内部配置|模型端点)|(?:请|帮我|能否|接下来|接着|随后|然后|现在|实际).*(?:逐字|显示|输出|展示|打印|列出|泄露|公开|提供)|SAMPLEINTERNALRULE|syntheticsecretcontent/i
  },
  {
    category: "self_harm_violence_illegal_minors",
    pattern: /(?:告诉我|教我|列出|给我|说明|怎么|怎样|如何|我想|帮我|能否|请|策划|提供|写).*(?:自杀|自残|伤害自己|攻击|制造武器|逃避侦查|入侵.*账号|诱导未成年人|未成年人.*(?:性互动|私密内容)|逃税|违法操作)|(?:自杀|自残|伤害自己|攻击|制造武器|逃避侦查|入侵.*账号|诱导未成年人|未成年人.*(?:性互动|私密内容)|逃税|违法操作).*(?:方法|步骤|如何实施|可执行|建议|具体操作|不被发现)|犯罪以后怎样.*逃避侦查|不想活了|(?:自杀方法|自残步骤|攻击.+的步骤|制造武器的方法|逃避侦查的方法|入侵账号的步骤|与未成年人性互动建议|诱导未成年人获取私密内容)\s*[:：]/i,
    topicPattern: /(?:自杀|自残|伤害自己|攻击|制造武器|逃避侦查|入侵.*账号|诱导未成年人|未成年人.*(?:性互动|私密内容)|逃税|违法操作|暴力|武器)/i,
    unsafeInstructionPattern: /(?:告诉我|教我|列出|给我|说明|怎么|怎样|如何|我想|帮我|能否|请|策划|提供|写).*(?:自杀|自残|伤害自己|攻击|制造武器|逃避侦查|入侵.*账号|诱导未成年人|未成年人.*(?:性互动|私密内容)|逃税|违法操作)|(?:接下来|接着|随后|然后|现在|实际).*(?:请|告诉|教|给出|提供|列出|执行|输出|展示|具体方法|具体步骤|这些步骤|细节)|SAMPLEACTION|syntheticactionable/i
  },
  {
    category: "professional_real_world",
    pattern: /(?:根据.*直接诊断(?:疾病|我)|(?:替我|给我|帮我|告诉我|怎么|如何|能否|请|制定|决定|写).*(?:诊断|处方药.*(?:剂量|次数)|用药剂量|治疗方案|起诉步骤|保证收益|贷款.*(?:审批规避|规避办法)|投资决定|规避.*法律责任|吃什么药|股票内幕|投资建议)|诊断结论\s*[:：]|(?:用药剂量|治疗方案|起诉步骤|保证收益(?:方案|承诺)|贷款审批规避(?:方法|办法)|投资决定)\s*[:：]|规避法律责任的(?:方法|步骤)\s*[:：]|真实资产.*投资)/i,
    topicPattern: /(?:诊断|处方药|用药剂量|治疗方案|起诉步骤|保证收益|贷款|投资决定|法律责任|吃什么药|股票内幕|投资建议|真实资产)/i,
    unsafeInstructionPattern: /(?:替我|给我|帮我|告诉我|怎么|如何|能否|请|制定|决定|写|说明|列出|接下来|接着|随后|然后|现在|实际).*(?:诊断|处方药|用药剂量|治疗方案|起诉|保证收益|贷款|投资|法律责任|可执行方案|SAMPLEDOSE)|SAMPLEDOSE|syntheticactionable/i
  }
];

export function evaluateMessage(content: string): SafetyDecision {
  const { compact, separatorless } = normalizeSafetyText(content);

  for (const rule of blockedRules) {
    const matchesConcreteRisk = rule.pattern.test(compact)
      || rule.pattern.test(separatorless)
      || (rule.topicPattern.test(separatorless) && rule.unsafeInstructionPattern.test(separatorless));

    if (!matchesConcreteRisk || isRefusalOrCondemnationOnly(rule, separatorless)) continue;
    return { action: "block", category: rule.category, policyVersion: SAFETY_POLICY_VERSION };
  }
  return allowByDefault();
}

export * from "./regression-cases";
