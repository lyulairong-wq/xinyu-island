import { authenticatedRequest, generationRequestId } from "./api-client";
import type { GenerationMode, Message } from "./chat-api";
import type { ContactMemory, CreateMemoryInput, SkillCode } from "./contacts-api";
import type { SkillDefinition } from "@xinyu/contracts";
export type { SkillDefinition } from "@xinyu/contracts";

export type SkillCardAction = "deepen" | "change_topic" | "return_to_chat";
export type SkillInputCode = "topic" | "answers" | "monthDay" | "birthDate" | "birthTimePeriod" | "number";

export type SkillCard = {
  skill: SkillCode;
  title: string;
  summary: string;
  disclaimer: "趣味解读，仅供娱乐参考";
  actions: SkillCardAction[];
};

const ENTERTAINMENT_DISCLAIMER = "趣味解读，仅供娱乐参考" as const;

const SKILL_DEFINITIONS: Record<SkillCode, SkillDefinition> = {
  tarot: { code: "tarot", title: "塔罗", summary: "围绕一个主题做单次趣味解读。", disclaimer: ENTERTAINMENT_DISCLAIMER, requiredInputs: ["topic"], noPrecisionRule: "不将结果说成确定事实", cardActions: ["deepen", "change_topic", "return_to_chat"] },
  mbti: { code: "mbti", title: "MBTI", summary: "通过轻量选择探索当下倾向。", disclaimer: ENTERTAINMENT_DISCLAIMER, requiredInputs: ["answers"], noPrecisionRule: "不作人格定论", cardActions: ["deepen", "change_topic", "return_to_chat"] },
  zodiac: { code: "zodiac", title: "星座", summary: "根据月日展开轻松聊天。", disclaimer: ENTERTAINMENT_DISCLAIMER, requiredInputs: ["monthDay"], noPrecisionRule: "不承诺运势或预测", cardActions: ["deepen", "change_topic", "return_to_chat"] },
  ziwei: { code: "ziwei", title: "紫微斗数", summary: "围绕主题进行东方意象化解读。", disclaimer: ENTERTAINMENT_DISCLAIMER, requiredInputs: ["topic"], optionalInputs: ["birthDate", "birthTimePeriod"], noPrecisionRule: "不做真实排盘或命运判断", cardActions: ["deepen", "change_topic", "return_to_chat"] },
  meihua: { code: "meihua", title: "梅花易数", summary: "以主题和数字展开启发式提问。", disclaimer: ENTERTAINMENT_DISCLAIMER, requiredInputs: ["topic"], optionalInputs: ["number"], noPrecisionRule: "不作吉凶断语或行动指令", cardActions: ["deepen", "change_topic", "return_to_chat"] }
};

export function skillDefinitions(codes: readonly SkillCode[]): SkillDefinition[] {
  return codes.map((code) => SKILL_DEFINITIONS[code]);
}

export type StartSkillSessionInput = {
  skill: SkillCode;
  mode: GenerationMode;
  requestId?: string;
  topic?: string;
  answers?: string[];
  monthDay?: string;
  birthDate?: string;
  birthTimePeriod?: string;
  number?: number;
  targetContactId?: string;
};

export type SkillSessionResult = {
  state: "fallback";
  fallback: "ordinary_chat";
  missingInputs: SkillInputCode[];
  mode: GenerationMode;
  chargedTokens: 0;
} | {
  userMessage: Message;
  assistantMessage: Message;
  skillCard: SkillCard;
  mode: GenerationMode;
  chargedTokens: number;
  notice: string;
  provider?: string;
  degraded?: boolean;
};

export function startSkillSession(conversationId: string, input: StartSkillSessionInput): Promise<SkillSessionResult> {
  const { requestId, ...payload } = input;
  return authenticatedRequest<SkillSessionResult>(
    `/chat/conversations/${encodeURIComponent(conversationId)}/skill-sessions`,
    {
      method: "POST",
      body: JSON.stringify({ ...payload, requestId: generationRequestId(requestId) })
    }
  );
}

export function rememberSkillFact(
  conversationId: string,
  contactId: string,
  input: CreateMemoryInput
): Promise<ContactMemory> {
  return authenticatedRequest<ContactMemory>(
    `/chat/conversations/${encodeURIComponent(conversationId)}/skill-sessions/${encodeURIComponent(contactId)}/memories`,
    { method: "POST", body: JSON.stringify(input) }
  );
}
