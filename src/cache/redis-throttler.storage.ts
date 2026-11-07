import { ThrottlerStorage } from '@nestjs/throttler';
import Redis from 'ioredis';
import { HitResult } from './memory-throttler.storage';

// Sliding-window-log check + record in ONE Lua script (Redis runs a script without interleaving
// other commands). Time comes from Redis itself, so API instances with skewed clocks agree.
const HIT_SCRIPT = `
local t = redis.call('TIME')
local now = t[1] * 1000 + math.floor(t[2] / 1000)
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now)
local n = redis.call('ZCARD', KEYS[1])
local first = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
if n >= limit then
  return {0, n, tonumber(first[2]) - now}
end
redis.call('ZADD', KEYS[1], now + ttl, now .. '-' .. ARGV[3])
redis.call('PEXPIRE', KEYS[1], ttl)
first = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
return {1, n + 1, tonumber(first[2]) - now}`;

// Rate-limit records in Redis (sorted set per key, score = expiry), so every API instance
// counts against the same limit. Same contract as the default in-memory storage.
export class RedisThrottlerStorage implements ThrottlerStorage {
  storage: Record<string, number[]> = {};

  constructor(private readonly redis: Redis) {}

  /** Atomic: counts the hit only if the window still has room. */
  async hit(
    key: string,
    ttlSeconds: number,
    limit: number,
  ): Promise<HitResult> {
    const nonce = Math.random().toString(36).slice(2);
    const [allowed, count, retryMs] = (await this.redis.eval(
      HIT_SCRIPT,
      1,
      `throttle:${key}`,
      ttlSeconds * 1000,
      limit,
      nonce,
    )) as [number, number, number];
    return {
      allowed: allowed === 1,
      count,
      retryAfter: Math.max(1, Math.ceil(retryMs / 1000)),
    };
  }

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
