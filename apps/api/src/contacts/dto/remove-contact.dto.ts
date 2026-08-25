import { IsBoolean, IsOptional } from "class-validator";

export class RemoveContactDto {
  @IsOptional() @IsBoolean() deleteConversations?: boolean;
  @IsOptional() @IsBoolean() deleteMemories?: boolean;
}
