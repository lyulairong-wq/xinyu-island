import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  content!: string;

  @IsUUID()
  requestId!: string;

  @IsIn(["free", "token"])
  mode!: "free" | "token";

  @IsOptional()
  @IsBoolean()
  memoryEnabled?: boolean;

  @IsOptional()
  @IsString()
  quoteMessageId?: string;
}
