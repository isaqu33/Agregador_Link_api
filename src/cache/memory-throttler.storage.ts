import { ThrottlerStorage } from '@nestjs/throttler';

export interface HitResult {
  allowed: boolean;
  /** hits inside the window, this one included when it was allowed */
  count: number;
  /** seconds until the oldest hit leaves the window */
  retryAfter: number;
}

// Sliding-window-log rate limit in process memory (single instance / local dev).
// `hit` is synchronous: check + record happen with no `await` in between, so two requests can
// never both read "9 of 10" and both get in.
export class MemoryThrottlerStorage implements ThrottlerStorage {
  storage: Record<string, number[]> = {};
  private readonly windows = new Map<string, number[]>();

  hit(key: string, ttlSeconds: number, limit: number): Promise<HitResult> {
    const now = Date.now();
    const live = (this.windows.get(key) ?? []).filter((expiry) => expiry > now);
    const retryAfter = live.length
      ? Math.max(1, Math.ceil((live[0] - now) / 1000))
      : 0;
    if (live.length >= limit) {
      this.windows.set(key, live);
      return Promise.resolve({
        allowed: false,
        count: live.length,
        retryAfter,
      });
    }
    live.push(now + ttlSeconds * 1000);
    this.windows.set(key, live);
    this.sweep(now);
    return Promise.resolve({
      allowed: true,
      count: live.length,
      retryAfter: Math.max(1, Math.ceil((live[0] - now) / 1000)),
    });
  }

  // ThrottlerStorage contract (kept so the module accepts this class)
  async getRecord(key: string): Promise<number[]> {
    const now = Date.now();
    return (this.windows.get(key) ?? []).filter((expiry) => expiry > now);
  }

  async addRecord(key: string, ttl: number): Promise<void> {
    const list = this.windows.get(key) ?? [];
    list.push(Date.now() + ttl * 1000);
    this.windows.set(key, list);
  }

  // keeps the map from growing forever
  private sweep(now: number) {
    if (this.windows.size < 5000) return;
    for (const [key, list] of this.windows) {
      if (list.every((expiry) => expiry <= now)) this.windows.delete(key);
    }
  }
}
