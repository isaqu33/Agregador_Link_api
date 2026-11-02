import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthService } from './jwt.service';
import { JwtAuthStrategy } from './jwt-auth.strategy';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('SECRET_JWT'),
        signOptions: {
          expiresIn: '24h',
        },
      }),
    }),
  ],
  providers: [JwtAuthStrategy, JwtAuthService],
  exports: [JwtModule, JwtAuthService],
})
export class JwtAuthModule {}
