import { IsBoolean, IsOptional, IsString, Length } from "class-validator";

export class UpdateConversationDto {
  @IsOptional()
  @IsBoolean()
  memoryEnabled?: boolean;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  title?: string;

  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}
