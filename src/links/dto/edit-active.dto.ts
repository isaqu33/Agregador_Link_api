import { IsBoolean, IsString } from 'class-validator';

export class EditActiveDto {
  @IsString()
  id: string;

  @IsBoolean()
  activation: boolean;
}
