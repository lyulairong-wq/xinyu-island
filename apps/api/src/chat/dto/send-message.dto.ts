import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class GenerationRequestDto {
  @IsUUID()
  requestId!: string;

  @IsIn(["free", "token"])
  mode!: "free" | "token";
}

export class SendMessageDto extends GenerationRequestDto {
  @IsString()
  @MinLength(1)
  content!: string;

  @IsOptional()
  @IsBoolean()
  memoryEnabled?: boolean;

  @IsOptional()
  @IsString()
  quoteMessageId?: string;
}
