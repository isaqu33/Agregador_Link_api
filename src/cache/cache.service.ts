import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

type Listener = (message: string) => void;

// INCR + EXPIRE as ONE atomic step on the Redis side. Two separate commands would leave the key
// without an expiry forever if the process died between them; checking TTL < 0 also heals keys
// that already lost theirs.
const INCR_WITH_TTL = `
local n = redis.call('INCR', KEYS[1])
if n == 1 or redis.call('TTL', KEYS[1]) < 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return n`;

// Small shared state used by more than one API instance: counters with expiry and a pub/sub channel.
// With REDIS_URL it goes through Redis (all instances agree); without it everything stays in this
// process, which is fine for a single instance and for local development.
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  readonly redis: Redis | null;
  private readonly subscriber: Redis | null;

  private counters = new Map<string, { n: number; expires: number }>();
  private listeners = new Map<string, Set<Listener>>();

  constructor(config: ConfigService) {
    const url = config.get<string>('REDIS_URL');
    if (!url) {
      this.redis = null;
      this.subscriber = null;
      return;
    }

    this.redis = new Redis(url, { maxRetriesPerRequest: 2 });
    this.subscriber = this.redis.duplicate();
    for (const client of [this.redis, this.subscriber]) {
      client.on('error', (e) => this.logger.error(`Redis: ${e.message}`));
    }
    this.subscriber.on('message', (channel, message) =>
      this.listeners.get(channel)?.forEach((l) => l(message)),
    );
  }

  /** +1 on `key`; the counter disappears `ttlSeconds` after its first hit. Returns the new value. */
  async incr(key: string, ttlSeconds: number): Promise<number> {
    if (this.redis) {
      return Number(await this.redis.eval(INCR_WITH_TTL, 1, key, ttlSeconds));
    }
    const now = Date.now();
    const current = this.counters.get(key);
    if (!current || current.expires <= now) {
      this.counters.set(key, { n: 1, expires: now + ttlSeconds * 1000 });
      this.sweep(now);
      return 1;
    }
    current.n += 1;
    return current.n;
  }

  async count(key: string): Promise<number> {
    if (this.redis) return Number(await this.redis.get(key)) || 0;
    const current = this.counters.get(key);
    return current && current.expires > Date.now() ? current.n : 0;
  }

  async reset(key: string) {
    if (this.redis) await this.redis.del(key);
    else this.counters.delete(key);
  }

  /** Delivers `message` to every instance that called `subscribe(channel, ...)`, this one included. */
  async publish(channel: string, message: string) {
    if (this.redis) {
      await this.redis.publish(channel, message);
      return;
    }
    this.listeners.get(channel)?.forEach((l) => l(message));
  }

  subscribe(channel: string, listener: Listener) {
    let set = this.listeners.get(channel);
    if (!set) {
      set = new Set();
      this.listeners.set(channel, set);
      this.subscriber
        ?.subscribe(channel)
        .catch((e) => this.logger.error(`Redis: ${e.message}`));
    }
    set.add(listener);
  }

  async onModuleDestroy() {
    await Promise.allSettled([this.redis?.quit(), this.subscriber?.quit()]);
  }

  // keeps the in-memory map from growing forever
  private sweep(now: number) {
    if (this.counters.size < 5000) return;
    for (const [k, v] of this.counters)
      if (v.expires <= now) this.counters.delete(k);
  }
}
