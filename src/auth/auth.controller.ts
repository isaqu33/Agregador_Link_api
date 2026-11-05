import { Body, Controller, Headers, HttpCode, NotFoundException, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';
import { OAuthLoginDto } from './dto/oauth.dto';
import { JwtAuthGuard } from './../jwt/jwt-auth.guard';
import { ForgotPasswordDto, ResetPasswordDto, VerifyEmailDto } from './dto/tokens.dto';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private config: ConfigService,
  ) {}

  @Post('register')
  @Throttle(5, 60)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle(10, 60)
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('forgot-password')
  @Throttle(3, 60)
  @HttpCode(200)
  forgot(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @Throttle(5, 60)
  @HttpCode(200)
  reset(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @Post('verify-email')
  @Throttle(10, 60)
  @HttpCode(200)
  verify(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Post('resend-verification')
  @Throttle(3, 60)
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  resend(@Req() req) {
    return this.authService.resendVerification(req.user.sub);
  }

  // Server-to-server: the Next server calls this after Google login. Protected by a shared secret.
  @Post('oauth')
  @HttpCode(200)
  @Throttle(30, 60)
  oauth(@Headers('x-oauth-secret') secret: string | undefined, @Body() dto: OAuthLoginDto) {
    const expected = this.config.get<string>('OAUTH_SHARED_SECRET');
    if (!expected) throw new NotFoundException(); // feature off
    const digest = (v: string) => createHash('sha256').update(v).digest();
    if (!secret || !timingSafeEqual(digest(secret), digest(expected))) {
      throw new UnauthorizedException();
    }
    return this.authService.oauthLogin(dto);
  }
}
