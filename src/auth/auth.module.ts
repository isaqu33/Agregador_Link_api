import { JwtAuthModule } from './../jwt/jwt.module';
import { UserModule } from './../user/user.module';
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
  imports: [UserModule, JwtAuthModule],
  controllers: [AuthController],
  exports: [AuthService],
  providers: [AuthService],
})
export class AuthModule {}
