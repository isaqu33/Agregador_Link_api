import { ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { HitResult } from '../cache/memory-throttler.storage';

// The browser reaches the API through the Next proxy, which forwards the visitor IP in
// x-forwarded-for. Without it (direct calls, local dev) the socket address is used.
export function clientIp(req: any): string {
  const forwarded = String(req.headers?.['x-forwarded-for'] ?? '')
    .split(',')[0]
    .trim();
  return forwarded || req.ip || 'unknown';
}

type AtomicStorage = {
  hit(key: string, ttl: number, limit: number): Promise<HitResult>;
};

export class AppThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): string {
    return clientIp(req);
  }

  // The stock guard reads the window and then writes to it in two steps, so a burst of requests
  // can all read "9 of 10" and all get in. Our storages expose `hit`, which checks and records
  // in one atomic step.
  async handleRequest(
    context: ExecutionContext,
    limit: number,
    ttl: number,
  ): Promise<boolean> {
    const storage = this.storageService as unknown as Partial<AtomicStorage>;
    if (typeof storage.hit !== 'function') {
      return super.handleRequest(context, limit, ttl);
    }

    const { req, res } = this.getRequestResponse(context);
    const key = this.generateKey(context, this.getTracker(req));
    const { allowed, count, retryAfter } = await storage.hit(key, ttl, limit);

    res.header('X-RateLimit-Limit', limit);
    res.header('X-RateLimit-Remaining', Math.max(0, limit - count));
    res.header('X-RateLimit-Reset', retryAfter);
    if (!allowed) {
      res.header('Retry-After', retryAfter);
      this.throwThrottlingException(context);
    }
    return true;
  }
}
