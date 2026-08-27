import { IsIn, IsString, Length } from "class-validator";

export const BETA_FEEDBACK_CATEGORIES = ["account", "chat", "skill", "privacy", "safety", "experience", "other"] as const;
export type BetaFeedbackCategory = (typeof BETA_FEEDBACK_CATEGORIES)[number];

export class CreateBetaFeedbackDto {
  @IsIn(BETA_FEEDBACK_CATEGORIES)
  category!: BetaFeedbackCategory;

  @IsString()
  @Length(10, 2_000)
  content!: string;
}
