import { BadRequestException } from "@nestjs/common";
import { evaluateMessage } from "@xinyu/safety";

const HAS_HAN_CHARACTER = /\p{Script=Han}/u;
const HAS_LATIN_CHARACTER = /\p{Script=Latin}/u;

export class GenerationPolicy {
  assertUserContent(content: string): string {
    return this.assertContent(content, "GENERATION_CHINESE_ONLY_REQUIRED");
  }

  assertQuoteContent(content: string): string {
    return this.assertContent(content, "GENERATION_QUOTE_REJECTED");
  }

  assertAssistantContent(content: string): string {
    return this.assertContent(content, "GENERATION_OUTPUT_REJECTED");
  }

  assertSkillContent(content: string): string {
    const normalized = this.normalize(content);
    if (!HAS_HAN_CHARACTER.test(normalized) || HAS_LATIN_CHARACTER.test(normalized)) {
      throw new BadRequestException({ code: "GENERATION_CHINESE_ONLY_REQUIRED" });
    }
    if (evaluateMessage(normalized).action !== "allow") {
      throw new BadRequestException({ code: "GENERATION_SAFETY_REJECTED" });
    }
    return normalized;
  }

  private assertContent(content: string, code: string): string {
    const normalized = this.normalize(content);

    if (!HAS_HAN_CHARACTER.test(normalized) || HAS_LATIN_CHARACTER.test(normalized) || evaluateMessage(normalized).action !== "allow") {
      throw new BadRequestException({ code });
    }

    return normalized;
  }

  private normalize(content: string) {
    return content.normalize("NFKC").replace(/[\p{C}\p{M}]/gu, "");
  }
}
