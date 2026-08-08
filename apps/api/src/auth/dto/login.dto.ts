import { IsEmail, IsOptional, IsString, Length } from "class-validator";

export class LoginDto {
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
