import { IsIn, IsString, Length } from "class-validator";

export class CreateMemoryDto {
  @IsString()
  @Length(1, 300)
  fact!: string;

  @IsIn(["normal", "sensitive"])
  sensitivity!: "normal" | "sensitive";
}
