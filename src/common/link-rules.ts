import { BadRequestException } from '@nestjs/common';

// Link types the page knows how to render. `Cabecalho` is a section title (no URL).
export const LINK_TYPES = [
  'Link',
  'Spotify',
  'Youtube',
  'Whatsapp',
  'Twitch',
  'Email',
  'Instagram',
  'Tiktok',
  'Telefone',
  'Cabecalho',
  'Pix',
  'Newsletter',
] as const;
export type LinkType = typeof LINK_TYPES[number];

export const SOCIAL_NETWORKS = [
  'instagram',
  'tiktok',
  'youtube',
  'x',
  'facebook',
  'linkedin',
  'github',
  'twitch',
  'spotify',
  'whatsapp',
  'email',
  'site',
] as const;
export type SocialNetwork = typeof SOCIAL_NETWORKS[number];

const HTTP_URL = /^https?:\/\/[^\s/$.?#][^\s]*$/i;
const MAILTO = /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const TEL = /^tel:\+?[0-9]{6,15}$/;

export function isHttpUrl(value: string): boolean {
  return value.length <= 2000 && HTTP_URL.test(value);
}

// Returns an error message, or null when the URL is acceptable for the type.
// Only http(s), mailto: and tel: ever reach the public page (no javascript:/data:).
export function linkError(type: string, link: string): string | null {
  switch (type) {
    case 'Cabecalho':
    case 'Newsletter':
      return null; // a header / e-mail form has no destination
    case 'Pix':
      // Pix key or "copia e cola" payload: copied by the visitor, never opened as a URL
      return /^[^\u0000-\u001f]{1,600}$/.test(link) ? null : 'Chave Pix inválida';
    case 'Email':
      return MAILTO.test(link) ? null : 'Use um e-mail válido (mailto:)';
    case 'Telefone':
      return TEL.test(link) ? null : 'Use um telefone válido (tel:+55...)';
    default:
      return isHttpUrl(link) ? null : 'URL inválida (use http:// ou https://)';
  }
}

export function assertValidLink(type: string, link: string | undefined) {
  const error = linkError(type, link ?? '');
  if (error) throw new BadRequestException(error);
}

export function socialUrlError(network: string, url: string): string | null {
  if (network === 'email') return MAILTO.test(url) ? null : 'E-mail inválido';
  return isHttpUrl(url) ? null : 'URL inválida';
}

// /@username lives next to real routes of the front, so these are never available.
export const RESERVED_USERNAMES = new Set([
  'admin', 'api', 'assets', 'costumer', 'login', 'register', 'media', 'u',
  'forgot-password', 'reset-password', 'verify-email', 'static', 'favicon.ico',
  'robots.txt', 'sitemap.xml', 'facelink', 'suporte', 'support', 'null', 'undefined',
]);

export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_.]{2,29}$/;

// Types whose `link` is not a URL to open: they have their own behaviour on the page.
export const NO_URL_TYPES = ['Cabecalho', 'Newsletter'];

export const PIXEL_PATTERNS = {
  meta: /^\d{5,20}$/,
  ga: /^G-[A-Z0-9]{4,15}$/,
};
