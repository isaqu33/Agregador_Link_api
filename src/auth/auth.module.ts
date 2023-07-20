import { JwtAuthModule } from './../jwt/jwt.module';
import { PrismaModule } from './../DataBase/prisma.module';
import { UserFirebase } from './userFirebase';
import { UserService } from './../user/user.service';
import { PrismaService } from './../DataBase/prisma.service';
import { UserModule } from './../user/user.module';
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
  imports:[UserModule, PrismaModule, JwtAuthModule],
  controllers: [AuthController],
  exports: [AuthService],
  providers: [AuthService, UserService, UserFirebase]
})
export class AuthModule {}
