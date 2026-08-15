import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn } from "class-validator";
import { SKILL_CODES, type SkillCode } from "@xinyu/contracts";

export class UpdateContactSkillsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsIn(SKILL_CODES, { each: true })
  skillCodes!: SkillCode[];

  @IsIn(SKILL_CODES)
  primarySkill!: SkillCode;
}
