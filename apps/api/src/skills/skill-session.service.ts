import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { loadConfig } from "@xinyu/config";
import type { SkillCard, SkillCode, SkillDefinition, SkillInputCode } from "@xinyu/contracts";
import { ChatGenerationCoordinator } from "../chat/chat-generation-coordinator";
import { buildContactSystemPrompt } from "../chat/chat.service";
import { ContactsService } from "../contacts/contacts.service";
import type { CreateMemoryDto } from "../contacts/dto/create-memory.dto";
import { PrismaService } from "../prisma/prisma.service";
import type { StartSkillSessionDto } from "./dto/start-skill-session.dto";
import { SkillCatalog } from "./skill-catalog";

type SkillConversation = {
  id: string;
  contactId: string;
  kind: string;
  memoryEnabled: boolean;
  members: Array<{ contactId: string; sortOrder: number }>;
};

type SkillContact = {
  id: string;
  name: string;
  tone: string;
  description?: string;
  skills: SkillCode[];
};

const PROMPT_SKILL_NAMES: Record<SkillCode, string> = {
  tarot: "塔罗",
  mbti: "人格倾向",
  zodiac: "星座",
  ziwei: "紫微斗数",
  meihua: "梅花易数"
};

@Injectable()
export class SkillSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contacts: ContactsService,
    private readonly coordinator: ChatGenerationCoordinator,
    private readonly catalog: SkillCatalog
  ) {}

  async start(userId: string, conversationId: string, input: StartSkillSessionDto) {
    const runtimeConfig = loadConfig(process.env);
    if (!runtimeConfig.beta.generationEnabled) throw new ForbiddenException({ code: "BETA_GENERATION_PAUSED" });
    if (!runtimeConfig.beta.tokenModeEnabled && input.mode === "token") {
      throw new ForbiddenException({ code: "BETA_TOKEN_MODE_DISABLED" });
    }
    const conversation = await this.ownedConversation(userId, conversationId);
    const contact = await this.skillContact(userId, conversation, input.targetContactId, input.skill);
    const definition = this.catalog.get(input.skill);
    const missingInputs = definition.requiredInputs.filter((code) => !this.hasInput(input, code));

    if (missingInputs.length > 0) {
      return {
        state: "fallback" as const,
        fallback: "ordinary_chat" as const,
        missingInputs,
        mode: input.mode,
        chargedTokens: 0
      };
    }

    const memoryFacts = conversation.memoryEnabled
      ? (await this.prisma.contactMemory.findMany({
          where: { userId, contactId: contact.id, sensitivity: "normal" },
          orderBy: { updatedAt: "desc" },
          take: 20
        })).map((memory) => memory.fact)
      : [];
    const card = this.card(definition);
    const modelConfig = runtimeConfig.freeModel;
    const result = await this.coordinator.generate({
      userId,
      conversationId: conversation.id,
      requestId: input.requestId,
      kind: "single",
      mode: input.mode,
      content: this.structuredContent(definition, input),
      displayContent: this.displayContent(definition),
      contacts: [{
        name: contact.name,
        systemPrompt: [
          buildContactSystemPrompt(contact, memoryFacts),
          this.skillSystemPrompt(definition)
        ].join("\n\n")
      }],
      maxInputCharacters: modelConfig.maxInputCharacters,
      maxOutputTokens: modelConfig.maxOutputTokens,
      purpose: "skill",
      assistantMetadata: { skillCard: { ...card, actions: [...card.actions] } }
    });

    if (!("assistantMessage" in result)) {
      throw new BadRequestException({ code: "SKILL_SESSION_RESULT_INVALID" });
    }

    return { ...result, skillCard: card };
  }

  async remember(
    userId: string,
    conversationId: string,
    contactId: string,
    input: CreateMemoryDto
  ) {
    const conversation = await this.ownedConversation(userId, conversationId);
    this.assertConversationContact(conversation, contactId);
    return this.contacts.createMemory(userId, contactId, input);
  }

  private async ownedConversation(userId: string, conversationId: string): Promise<SkillConversation> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      include: { members: { orderBy: { sortOrder: "asc" } } }
    });
    if (!conversation) throw new NotFoundException("找不到该对话");
    return conversation as SkillConversation;
  }

  private async skillContact(
    userId: string,
    conversation: SkillConversation,
    targetContactId: string | undefined,
    skill: SkillCode
  ) {
    const contactId = conversation.kind === "group"
      ? this.requiredGroupContact(conversation, targetContactId)
      : this.singleContact(conversation, targetContactId);
    const contact = await this.contacts.resolve(userId, contactId) as SkillContact;
    if (!contact.skills.includes(skill)) {
      throw new BadRequestException({ code: "SKILL_NOT_MOUNTED" });
    }
    return contact;
  }

  private requiredGroupContact(conversation: SkillConversation, targetContactId?: string) {
    if (!targetContactId) throw new BadRequestException({ code: "SKILL_GROUP_TARGET_REQUIRED" });
    this.assertConversationContact(conversation, targetContactId);
    return targetContactId;
  }

  private singleContact(conversation: SkillConversation, targetContactId?: string) {
    if (targetContactId && targetContactId !== conversation.contactId) {
      throw new BadRequestException({ code: "SKILL_CONTACT_NOT_ELIGIBLE" });
    }
    return conversation.contactId;
  }

  private assertConversationContact(conversation: SkillConversation, contactId: string) {
    const eligible = conversation.kind === "group"
      ? conversation.members.some((member) => member.contactId === contactId)
      : conversation.contactId === contactId;
    if (!eligible) throw new BadRequestException({ code: "SKILL_CONTACT_NOT_ELIGIBLE" });
  }

  private hasInput(input: StartSkillSessionDto, code: SkillInputCode) {
    const value = input[code];
    if (Array.isArray(value)) return value.some((answer) => answer.trim().length > 0);
    if (typeof value === "string") return value.trim().length > 0;
    return typeof value === "number" && Number.isInteger(value);
  }

  private card(definition: SkillDefinition): SkillCard {
    return {
      skill: definition.code,
      title: definition.title,
      summary: definition.summary,
      disclaimer: definition.disclaimer,
      actions: [...definition.cardActions]
    };
  }

  private structuredContent(definition: SkillDefinition, input: StartSkillSessionDto) {
    const lines = [
      `趣味技能回合：${PROMPT_SKILL_NAMES[definition.code]}。`,
      `玩法边界：${definition.noPrecisionRule}。`,
      `固定说明：${definition.disclaimer}。`,
      ...this.inputLines(input),
      "请只用中文完成一次中性、非确定性的趣味解读，并以一个开放式反思问题结束。"
    ];
    return lines.join("\n");
  }

  private displayContent(definition: SkillDefinition) {
    return `我想体验一次${definition.title}趣味解读。`;
  }

  private inputLines(input: StartSkillSessionDto) {
    return [
      input.topic?.trim() ? `用户主题：${input.topic.trim()}。` : undefined,
      input.answers?.length ? `用户选择：${input.answers.map((answer) => answer.trim()).filter(Boolean).join("、")}。` : undefined,
      input.monthDay ? `用户提供的月日：${input.monthDay}。` : undefined,
      input.birthDate ? `用户提供的出生日期：${input.birthDate}。` : undefined,
      input.birthTimePeriod?.trim() ? `用户提供的大致时段：${input.birthTimePeriod.trim()}。` : undefined,
      input.number !== undefined ? `用户自主选择的数字：${input.number}。` : undefined
    ].filter((line): line is string => line !== undefined);
  }

  private skillSystemPrompt(definition: SkillDefinition) {
    return [
      `当前仅运行一次${PROMPT_SKILL_NAMES[definition.code]}趣味技能，不运行其他技能。`,
      `必须遵守边界：${definition.noPrecisionRule}。`,
      `结果仅作娱乐和自我探索，保留固定说明：${definition.disclaimer}。`,
      "不得给出现实预测、专业结论或要求用户执行的指令。"
    ].join("\n");
  }
}
