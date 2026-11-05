import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  @MaxLength(254)
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}

export class VerifyEmailDto {
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token: string;
}
