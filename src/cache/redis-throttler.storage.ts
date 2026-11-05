import { ThrottlerStorage } from '@nestjs/throttler';
import Redis from 'ioredis';

// Rate-limit records in Redis (sorted set per key, score = expiry), so every API instance
// counts against the same limit. Same contract as the default in-memory storage.
export class RedisThrottlerStorage implements ThrottlerStorage {
  storage: Record<string, number[]> = {};

  constructor(private readonly redis: Redis) {}

  async getRecord(key: string): Promise<number[]> {
    const k = `throttle:${key}`;
    await this.redis.zremrangebyscore(k, '-inf', Date.now());
    const rows = await this.redis.zrange(k, 0, -1, 'WITHSCORES');
    const expiries: number[] = [];
    for (let i = 1; i < rows.length; i += 2) expiries.push(Number(rows[i]));
    return expiries;
  }

  async addRecord(key: string, ttl: number): Promise<void> {
    const k = `throttle:${key}`;
    const expiry = Date.now() + ttl * 1000;
    await this.redis
      .multi()
      .zadd(k, expiry, `${expiry}-${Math.random().toString(36).slice(2)}`)
      .pexpire(k, ttl * 1000)
      .exec();
  }
}
