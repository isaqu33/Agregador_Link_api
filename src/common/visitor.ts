export type Device = 'mobile' | 'tablet' | 'desktop';

// Coarse device class from the User-Agent (enough for a chart; not a fingerprint).
export function deviceFromUserAgent(ua?: string): Device {
  const s = (ua ?? '').toLowerCase();
  if (/ipad|tablet|kindle|silk|playbook/.test(s) || (/android/.test(s) && !/mobile/.test(s))) {
    return 'tablet';
  }
  if (/mobi|iphone|ipod|android|windows phone/.test(s)) return 'mobile';
  return 'desktop';
}

// "https://www.Instagram.com/x?y=1" -> "instagram.com"; anything unusable -> "direto".
export function referrerHost(raw?: string): string {
  if (!raw) return 'direto';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'direto';
    return url.hostname.replace(/^www\./, '').toLowerCase().slice(0, 100) || 'direto';
  } catch {
    return 'direto';
  }
}
