import { csvCell, toCsv } from './csv';
import { toEmbedUrl } from './embed';
import { deviceFromUserAgent, referrerHost } from './visitor';
import { linkError } from './link-rules';

describe('toEmbedUrl', () => {
  it.each([
    ['Youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['Youtube', 'https://youtu.be/dQw4w9WgXcQ?t=10', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['Youtube', 'https://m.youtube.com/shorts/dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['Youtube', 'https://www.youtube.com/playlist?list=PLabcdefghijklmnop', 'https://www.youtube-nocookie.com/embed/videoseries?list=PLabcdefghijklmnop'],
    ['Spotify', 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=x', 'https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC'],
    ['Spotify', 'https://open.spotify.com/intl-pt/playlist/37i9dQZF1DXcBWIGoYBM5M', 'https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M'],
  ])('%s %s', (type, link, expected) => expect(toEmbedUrl(type, link)).toBe(expected));

  it.each([
    ['Youtube', 'https://youtube.com/@canal'],
    ['Youtube', 'https://evil.com/watch?v=dQw4w9WgXcQ'],
    ['Youtube', 'https://www.youtube.com/watch?v=<script>'],
    ['Spotify', 'https://evil.com/track/4uLU6hMCjMI75M1A2tKUQC'],
    ['Spotify', 'https://open.spotify.com/user/someone'],
    ['Link', 'https://youtu.be/dQw4w9WgXcQ'],
    ['Youtube', 'not a url'],
  ])('no player for %s %s', (type, link) => expect(toEmbedUrl(type, link)).toBeNull());
});

describe('csv', () => {
  it('escapes separators, quotes and line breaks', () => {
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('diz "oi"')).toBe('"diz ""oi"""');
    expect(csvCell('a\nb')).toBe('"a\nb"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(5)).toBe('5');
  });

  it.each(['=1+1', '+cmd', '-2', '@SUM(A1)', '\tx'])('neutralises formula injection %p', (v) => {
    expect(csvCell(v).startsWith("'") || csvCell(v).startsWith('"\'')).toBe(true);
  });

  it('starts with a BOM and uses CRLF', () => {
    expect(toCsv(['a', 'b'], [[1, 2]])).toBe('﻿a;b\r\n1;2\r\n');
  });
});

describe('visitor', () => {
  it.each([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Mobile/15E148', 'mobile'],
    ['Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari', 'mobile'],
    ['Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', 'tablet'],
    ['Mozilla/5.0 (Linux; Android 13; SM-X700) Safari', 'tablet'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome', 'desktop'],
    [undefined, 'desktop'],
  ])('device of %s', (ua, expected) => expect(deviceFromUserAgent(ua as any)).toBe(expected));

  it('keeps only the host of the referrer', () => {
    expect(referrerHost('https://www.Instagram.com/p/abc?x=1')).toBe('instagram.com');
    expect(referrerHost('')).toBe('direto');
    expect(referrerHost(undefined)).toBe('direto');
    expect(referrerHost('javascript:alert(1)')).toBe('direto');
    expect(referrerHost('lixo')).toBe('direto');
  });
});

describe('link-rules for the new types', () => {
  it('Newsletter has no URL; Pix accepts a key or copy-paste payload but not control chars', () => {
    expect(linkError('Newsletter', '')).toBeNull();
    expect(linkError('Pix', 'maria@x.com')).toBeNull();
    expect(linkError('Pix', '00020126580014br.gov.bcb.pix0136abc')).toBeNull();
    expect(linkError('Pix', '')).not.toBeNull();
    expect(linkError('Pix', 'a\nb')).not.toBeNull();
    expect(linkError('Pix', 'x'.repeat(601))).not.toBeNull();
  });
});
