import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Connection } from 'mongoose';
import { CacheService } from '../cache/cache.service';

// Liveness: the process is up. Readiness: it can serve traffic (Mongo connected, Redis answering).
@ApiExcludeController()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    @InjectConnection() private readonly mongo: Connection,
    private readonly cache: CacheService,
  ) {}

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    const mongo = this.mongo.readyState === 1;
    let redis: boolean | 'disabled' = 'disabled';
    if (this.cache.redis) {
      redis = await this.cache.redis
        .ping()
        .then((r) => r === 'PONG')
        .catch(() => false);
    }
    const ok = mongo && redis !== false;
    const body = { status: ok ? 'ok' : 'unavailable', mongo, redis };
    if (!ok) throw new ServiceUnavailableException(body);
    return body;
  }
}
