export const CURRENT_CONSENT_DOCUMENT_VERSION = "1.0" as const;

export const CONSENT_DOCUMENT_TYPES = [
  "terms",
  "privacy",
  "entertainment_notice"
] as const;

export type ConsentDocumentType = (typeof CONSENT_DOCUMENT_TYPES)[number];

export type ConsentDocument = {
  type: ConsentDocumentType;
  title: string;
  version: typeof CURRENT_CONSENT_DOCUMENT_VERSION;
  content: string;
};

const terms: ConsentDocument = {
  type: "terms",
  title: "用户协议（内部封闭测试版 v1.0）",
  version: CURRENT_CONSENT_DOCUMENT_VERSION,
  content: "心屿当前为内部封闭测试产品，仅面向成年人提供娱乐与陪伴体验。AI 回复仅供娱乐参考，不构成医疗、法律、财务或其他专业意见；请勿将回复作为现实决策依据。"
};

const privacy: ConsentDocument = {
  type: "privacy",
  title: "隐私政策（内部封闭测试版 v1.0）",
  version: CURRENT_CONSENT_DOCUMENT_VERSION,
  content: "心屿仅为提供服务所需处理账号、对话与用户明确保存的记忆。长期记忆按“用户 × AI 联系人”隔离；你可在“我的 → 记忆管理”查看和删除已保存内容。请勿输入身份证、精确住址、联系方式等高敏感信息。"
};

const entertainmentNotice: ConsentDocument = {
  type: "entertainment_notice",
  title: "娱乐使用提示（内部封闭测试版 v1.0）",
  version: CURRENT_CONSENT_DOCUMENT_VERSION,
  content: "塔罗、MBTI、星座、紫微斗数和梅花易数均属于趣味解读。结果不保证准确性，不作预测承诺，不提供现实行动指令；涉及医疗、法律、财务、伤害等高风险话题时，产品会转为安全回应。"
};

export const CONSENT_DOCUMENTS: readonly ConsentDocument[] = [
  terms,
  privacy,
  entertainmentNotice
];
