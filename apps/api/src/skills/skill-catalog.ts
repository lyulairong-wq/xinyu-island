import type { SkillCode, SkillDefinition } from "@xinyu/contracts";

const ENTERTAINMENT_DISCLAIMER = "趣味解读，仅供娱乐参考" as const;
const CARD_ACTIONS = ["deepen", "change_topic", "return_to_chat"] as const;

function definition(skill: SkillDefinition): SkillDefinition {
  return Object.freeze({
    ...skill,
    requiredInputs: Object.freeze([...skill.requiredInputs]),
    optionalInputs: skill.optionalInputs ? Object.freeze([...skill.optionalInputs]) : undefined,
    cardActions: Object.freeze([...skill.cardActions])
  });
}

const DEFINITIONS: readonly SkillDefinition[] = Object.freeze([
  definition({
    code: "tarot",
    title: "塔罗",
    summary: "围绕一个主题随机抽取单张牌，做主题化趣味解读。",
    disclaimer: ENTERTAINMENT_DISCLAIMER,
    requiredInputs: ["topic"],
    noPrecisionRule: "不将抽取结果说成确定事实",
    cardActions: [...CARD_ACTIONS]
  }),
  definition({
    code: "mbti",
    title: "MBTI",
    summary: "通过轻量选择题和自然追问，探索当下倾向。",
    disclaimer: ENTERTAINMENT_DISCLAIMER,
    requiredInputs: ["answers"],
    noPrecisionRule: "不作心理测评或人格定论",
    cardActions: [...CARD_ACTIONS]
  }),
  definition({
    code: "zodiac",
    title: "星座",
    summary: "根据月日展开轻松的星座主题聊天。",
    disclaimer: ENTERTAINMENT_DISCLAIMER,
    requiredInputs: ["monthDay"],
    noPrecisionRule: "不承诺运势或精确预测",
    cardActions: [...CARD_ACTIONS]
  }),
  definition({
    code: "ziwei",
    title: "紫微斗数",
    summary: "围绕主题进行东方意象化的趣味解读。",
    disclaimer: ENTERTAINMENT_DISCLAIMER,
    requiredInputs: ["topic"],
    optionalInputs: ["birthDate", "birthTimePeriod"],
    noPrecisionRule: "不做真实排盘或命运判断",
    cardActions: [...CARD_ACTIONS]
  }),
  definition({
    code: "meihua",
    title: "梅花易数",
    summary: "以主题和自主选择的数字展开启发式趣味提问。",
    disclaimer: ENTERTAINMENT_DISCLAIMER,
    requiredInputs: ["topic"],
    optionalInputs: ["number"],
    noPrecisionRule: "不作吉凶断语或行动指令",
    cardActions: [...CARD_ACTIONS]
  })
]);

export class SkillCatalog {
  get(code: SkillCode): SkillDefinition {
    const skill = DEFINITIONS.find((definition) => definition.code === code);
    if (!skill) throw new Error(`Unknown approved skill: ${code}`);
    return skill;
  }

  list(): SkillDefinition[] {
    return [...DEFINITIONS];
  }
}
