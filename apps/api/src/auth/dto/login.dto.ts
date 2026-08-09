import { Transform } from "class-transformer";
import { IsEmail, IsOptional, IsString, Length } from "class-validator";

export class LoginDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsEmail()
  email!: string;

  @IsString()
  @Length(1, 128)
  password!: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  deviceLabel?: string;
}
