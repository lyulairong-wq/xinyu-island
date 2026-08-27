import { Equals, IsBoolean, IsString, Length } from "class-validator";

export class DeleteAccountDto {
  @IsString()
  @Length(8, 128)
  password!: string;

  @IsBoolean()
  @Equals(true)
  confirmed!: true;
}
