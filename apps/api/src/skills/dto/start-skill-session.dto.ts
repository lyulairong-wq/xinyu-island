import { SKILL_CODES, type SkillCode } from "@xinyu/contracts";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min
} from "class-validator";
import { GenerationRequestDto } from "../../chat/dto/send-message.dto";

export class StartSkillSessionDto extends GenerationRequestDto {
  @IsIn(SKILL_CODES)
  skill!: SkillCode;

  @IsOptional()
  @IsString()
  @Length(1, 300)
  topic?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  answers?: string[];

  @IsOptional()
  @Matches(/^(?:0?[1-9]|1[0-2])-(?:0?[1-9]|[12]\d|3[01])$/)
  monthDay?: string;

  @IsOptional()
  @Matches(/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/)
  birthDate?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  birthTimePeriod?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999_999)
  number?: number;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  targetContactId?: string;
}
