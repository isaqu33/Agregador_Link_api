import { ThrottlerGuard } from '@nestjs/throttler';

// The browser reaches the API through the Next proxy, which forwards the visitor IP in
// x-forwarded-for. Without it (direct calls, local dev) the socket address is used.
export function clientIp(req: any): string {
  const forwarded = String(req.headers?.['x-forwarded-for'] ?? '')
    .split(',')[0]
    .trim();
  return forwarded || req.ip || 'unknown';
}

export class AppThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): string {
    return clientIp(req);
  }
}
