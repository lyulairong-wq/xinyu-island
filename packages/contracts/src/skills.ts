export const SKILL_CODES = ["tarot", "mbti", "zodiac", "ziwei", "meihua"] as const;

export type SkillCode = (typeof SKILL_CODES)[number];

export const SKILL_CARD_ACTIONS = ["deepen", "change_topic", "return_to_chat"] as const;

export type SkillCardAction = (typeof SKILL_CARD_ACTIONS)[number];

export type SkillInputCode = "topic" | "answers" | "monthDay" | "birthDate" | "birthTimePeriod" | "number";

export interface SkillCard {
  skill: SkillCode;
  title: string;
  summary: string;
  disclaimer: "趣味解读，仅供娱乐参考";
  actions: readonly SkillCardAction[];
}

export interface SkillDefinition {
  code: SkillCode;
  title: string;
  summary: string;
  disclaimer: SkillCard["disclaimer"];
  requiredInputs: readonly SkillInputCode[];
  optionalInputs?: readonly SkillInputCode[];
  noPrecisionRule: string;
  cardActions: readonly SkillCardAction[];
}
