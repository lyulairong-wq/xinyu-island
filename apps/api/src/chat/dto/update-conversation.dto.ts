import { IsBoolean } from "class-validator";

export class UpdateConversationDto {
  @IsBoolean()
  memoryEnabled!: boolean;
}
