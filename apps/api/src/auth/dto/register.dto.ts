import { Transform, Type } from "class-transformer";
import { IsArray, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Length, MinLength, ValidateNested } from "class-validator";

class ConsentDto {
  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsString()
  @Length(1, 32)
  version!: string;
}

export class RegisterDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @Length(8, 128)
  password!: string;

  @IsString()
  @Length(1, 40)
  nickname!: string;

  @IsIn(["under_13", "13_15", "16_17", "18_plus", "undisclosed"])
  ageBand!: string;

  @IsOptional()
  @IsString()
  @Length(8, 64)
  inviteCode?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConsentDto)
  consents!: ConsentDto[];

  @IsOptional()
  @IsString()
  @Length(1, 120)
  @Type(() => String)
  deviceLabel = "web";
}

export { ConsentDto };
