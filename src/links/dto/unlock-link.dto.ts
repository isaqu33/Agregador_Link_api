import { IsMongoId, IsString, MaxLength, MinLength } from 'class-validator';

export class UnlockLinkDto {
  @IsMongoId()
  linkId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password: string;
}
