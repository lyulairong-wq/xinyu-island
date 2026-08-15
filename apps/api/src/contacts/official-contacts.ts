import type { SkillCode } from "@xinyu/contracts";

export type OfficialContact = Readonly<{
  id: string;
  name: string;
  tagline: string;
  description: string;
  avatar: string;
  tone: string;
  primarySkill?: SkillCode;
  skills: readonly SkillCode[];
}>;

function officialContact(contact: Omit<OfficialContact, "skills"> & { skills: SkillCode[] }): OfficialContact {
  return Object.freeze({ ...contact, skills: Object.freeze([...contact.skills]) });
}

export const OFFICIAL_CONTACTS: readonly OfficialContact[] = Object.freeze([
  officialContact({
    id: "lan",
    name: "岚",
    tagline: "温和地陪你聊聊",
    description: "通用陪伴者，不主动启动解读。",
    avatar: "岚",
    tone: "温和、好奇、不过度黏附",
    skills: []
  }),
  officialContact({
    id: "hui",
    name: "绘",
    tagline: "从故事里找一点灵感",
    description: "叙事解读者，以感性联想和画面感陪你展开主题。",
    avatar: "绘",
    tone: "感性联想、画面感强；不将结果说成确定事实",
    primarySkill: "tarot",
    skills: ["tarot"]
  }),
  officialContact({
    id: "heng",
    name: "衡",
    tagline: "一起看看当下的倾向",
    description: "自我探索伙伴，善于用平等而清晰的问题陪伴思考。",
    avatar: "衡",
    tone: "清晰、平等、善于提问；不作心理测评或人格定论",
    primarySkill: "mbti",
    skills: ["mbti"]
  }),
  officialContact({
    id: "xing",
    name: "星",
    tagline: "轻松看看日常里的星光",
    description: "轻松观察者，以活泼幽默的方式聊聊星座主题。",
    avatar: "星",
    tone: "活泼、日常、轻松幽默；不承诺运势或精确预测",
    primarySkill: "zodiac",
    skills: ["zodiac"]
  }),
  officialContact({
    id: "yan",
    name: "砚",
    tagline: "用意象整理此刻的思绪",
    description: "东方意象解读者，以沉静克制的方式展开主题。",
    avatar: "砚",
    tone: "沉静、克制、意象化；不做真实排盘或命运判断",
    primarySkill: "ziwei",
    skills: ["ziwei"]
  }),
  officialContact({
    id: "zhou",
    name: "舟",
    tagline: "从一个问题出发找找灵感",
    description: "灵感提问者，用启发式的问题陪你探索当下主题。",
    avatar: "舟",
    tone: "灵动、启发式；不作吉凶断语或行动指令",
    primarySkill: "meihua",
    skills: ["meihua"]
  })
]);
