import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsOptional, IsString } from "class-validator";

export class CreateGroupDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @IsString({ each: true })
  contactIds!: string[];

  @IsOptional()
  @IsBoolean()
  memoryEnabled?: boolean;
}
