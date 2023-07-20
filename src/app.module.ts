import { AuthService } from './auth/auth.service';
import { UserService } from 'src/user/user.service';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';

import { AuthModule } from './auth/auth.module';

import { PrismaService } from './DataBase/prisma.service';
import { JwtAuthModule } from './jwt/jwt.module';
import { ConfigModule } from '@nestjs/config'

import { APP_GUARD } from '@nestjs/core';
import { LinksModule } from './links/links.module';





@Module({
  imports: [
    UserModule,
    AuthModule,
    JwtAuthModule,
    ConfigModule.forRoot({
      isGlobal: true
    }),
    LinksModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AuthService,
    UserService,
    PrismaService,
  ],

})
export class AppModule { }
