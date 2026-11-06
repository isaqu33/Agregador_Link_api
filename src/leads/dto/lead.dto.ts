import {
  IsEmail,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CaptureLeadDto {
  @IsMongoId()
  linkId: string;

  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  // honeypot: hidden in the form, bots fill it
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

export class DeleteLeadDto {
  @IsMongoId()
  id: string;
}
