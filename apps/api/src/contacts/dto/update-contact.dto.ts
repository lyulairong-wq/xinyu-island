import { IsOptional, IsString, Length } from "class-validator";
import { UpdateContactSkillsDto } from "./update-contact-skills.dto";

export class UpdateContactDto extends UpdateContactSkillsDto {
  @IsOptional() @IsString() @Length(1, 40) name?: string;
  @IsOptional() @IsString() @Length(1, 80) tagline?: string;
  @IsOptional() @IsString() @Length(1, 300) description?: string;
  @IsOptional() @IsString() @Length(1, 40) tone?: string;
}
