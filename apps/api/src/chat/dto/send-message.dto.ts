import { IsBoolean, IsIn, IsOptional, IsString, Length } from "class-validator";

export class SendMessageDto {
  @IsString()
  @Length(1, 4000)
  content!: string;

  @IsIn(["free", "token"])
  mode!: "free" | "token";

  @IsOptional()
  @IsBoolean()
  memoryEnabled?: boolean;
}
