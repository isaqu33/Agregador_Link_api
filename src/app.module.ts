import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthModule } from './jwt/jwt.module';
import { LinksModule } from './links/links.module';
import { StorageModule } from './storage/storage.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { MailModule } from './mail/mail.module';
import { CacheModule } from './cache/cache.module';
import { CacheService } from './cache/cache.service';
import { RedisThrottlerStorage } from './cache/redis-throttler.storage';
import { AppThrottlerGuard } from './common/app-throttler.guard';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('DATABASE_URL'),
      }),
    }),
    CacheModule,
    // default limit per IP and route; sensitive routes override it with @Throttle
    ThrottlerModule.forRootAsync({
      inject: [CacheService],
      useFactory: (cache: CacheService) => ({
        ttl: 60,
        limit: 120,
        storage: cache.redis ? new RedisThrottlerStorage(cache.redis) : undefined,
      }),
    }),
    UserModule,
    AuthModule,
    JwtAuthModule,
    LinksModule,
    StorageModule,
    AnalyticsModule,
    MailModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: AppThrottlerGuard }],
})
export class AppModule {}
