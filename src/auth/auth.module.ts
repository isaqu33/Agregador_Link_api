import { JwtAuthModule } from './../jwt/jwt.module';
import { UserModule } from './../user/user.module';
import { Module } from '@nestjs/common';
import { MailModule } from './../mail/mail.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
  imports: [UserModule, JwtAuthModule, MailModule],
  controllers: [AuthController],
  exports: [AuthService],
  providers: [AuthService],
})
export class AuthModule {}
