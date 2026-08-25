import { describe, expect, it } from "vitest";
import { OFFICIAL_CONTACTS } from "../contacts/official-contacts";
import { SkillCatalog } from "./skill-catalog";

describe("SkillCatalog", () => {
  const catalog = new SkillCatalog();

  it("exposes exactly the five approved skills in their launch order", () => {
    expect(catalog.list().map((skill) => skill.code)).toEqual(["tarot", "mbti", "zodiac", "ziwei", "meihua"]);
  });

  it("publishes the fixed entertainment boundary and minimum input rules", () => {
    expect(catalog.get("tarot")).toMatchObject({
      requiredInputs: ["topic"],
      noPrecisionRule: "不将抽取结果说成确定事实",
      cardActions: ["deepen", "change_topic", "return_to_chat"],
      disclaimer: "趣味解读，仅供娱乐参考"
    });
    expect(catalog.get("ziwei")).toMatchObject({
      requiredInputs: ["topic"],
      optionalInputs: ["birthDate", "birthTimePeriod"],
      noPrecisionRule: "不做真实排盘或命运判断"
    });
  });

  it("returns the exact definition for an approved code", () => {
    expect(catalog.get("zodiac")).toMatchObject({ code: "zodiac", requiredInputs: ["monthDay"] });
  });
});

describe("OFFICIAL_CONTACTS", () => {
  it("keeps 岚 skill-free and 绘 tarot-specialized", () => {
    expect(officialById("lan").skills).toEqual([]);
    expect(officialById("hui").primarySkill).toBe("tarot");
  });

  it("keeps all six official profiles ordered, bound to approved skills, and immutable", () => {
    expect(OFFICIAL_CONTACTS.map((contact) => [contact.id, contact.primarySkill, contact.skills])).toEqual([
      ["lan", undefined, []],
      ["hui", "tarot", ["tarot"]],
      ["heng", "mbti", ["mbti"]],
      ["xing", "zodiac", ["zodiac"]],
      ["yan", "ziwei", ["ziwei"]],
      ["zhou", "meihua", ["meihua"]]
    ]);
    expect(Object.isFrozen(OFFICIAL_CONTACTS)).toBe(true);
    expect(OFFICIAL_CONTACTS.every((contact) => Object.isFrozen(contact) && Object.isFrozen(contact.skills))).toBe(true);
  });
});

function officialById(id: string) {
  const contact = OFFICIAL_CONTACTS.find((candidate) => candidate.id === id);
  if (!contact) throw new Error(`Missing official contact: ${id}`);
  return contact;
}
