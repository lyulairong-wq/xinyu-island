import { authenticatedRequest, generationRequestId } from "./api-client";
import type { GenerationMode, Message } from "./chat-api";
import type { ContactMemory, CreateMemoryInput, SkillCode } from "./contacts-api";

export type SkillCardAction = "deepen" | "change_topic" | "return_to_chat";
export type SkillInputCode = "topic" | "answers" | "monthDay" | "birthDate" | "birthTimePeriod" | "number";

export type SkillCard = {
  skill: SkillCode;
  title: string;
  summary: string;
  disclaimer: "趣味解读，仅供娱乐参考";
  actions: SkillCardAction[];
};

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
