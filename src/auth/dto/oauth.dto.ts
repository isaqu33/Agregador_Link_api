import { IsBoolean, IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';

// Sent by the Next server after it verified the provider login (never by a browser).
export class OAuthLoginDto {
  @IsIn(['google'])
  provider: string;

  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsBoolean()
  emailVerified: boolean;
}
