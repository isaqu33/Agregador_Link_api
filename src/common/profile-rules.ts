import { BadRequestException, ConflictException } from '@nestjs/common';
import { RESERVED_USERNAMES, socialUrlError } from './link-rules';

interface ProfileInput {
  name?: string;
  photoURL?: string;
  template?: string;
  title?: string;
  about?: string;
  username?: string;
  socials?: { network: string; url: string }[];
  pixels?: { meta?: string; ga?: string };
}

const TEMPLATE_KEYS = new Set([
  'cor',
  'formato',
  'fonte',
  'botao',
  'texto',
  'fundoMidia',
  'marca',
]);
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const MEDIA_PATH =
  /^\/media\/([0-9a-f]{24})\/[0-9a-f-]{36}\.(jpg|png|webp|gif|mp4|webm)$/;

/**
 * `template` is a JSON string the front reads to paint the page. Only known keys, only safe values:
 * the background media must be a file this user uploaded, the text color a plain hex color.
 */
export function templateError(template: string, userId: string) {
  let value: unknown;
  try {
    value = JSON.parse(template);
  } catch {
    return 'template deve ser um JSON válido';
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return 'template deve ser um objeto';
  }
  for (const [key, item] of Object.entries(value)) {
    if (!TEMPLATE_KEYS.has(key)) return `template: campo desconhecido (${key})`;
    if (key === 'marca') {
      if (typeof item !== 'boolean')
        return 'template: marca deve ser true ou false';
      continue;
    }
    if (typeof item !== 'string' || item.length > 300) {
      return `template: ${key} inválido`;
    }
    if (key === 'texto' && item !== '' && !HEX_COLOR.test(item)) {
      return 'template: texto deve ser uma cor no formato #rrggbb';
    }
    if (key === 'fundoMidia' && item !== '') {
      const match = MEDIA_PATH.exec(item);
      if (!match || match[1] !== userId) {
        return 'template: o fundo deve ser um arquivo enviado por você';
      }
    }
  }
  return null;
}

// Shared by the main page (User) and extra pages: same fields, same rules.
export function checkProfileInput(dto: ProfileInput, userId: string) {
  if (dto.template !== undefined) {
    const error = templateError(dto.template, userId);
    if (error) throw new BadRequestException(error);
  }
  if (dto.username !== undefined && RESERVED_USERNAMES.has(dto.username)) {
    throw new ConflictException('Nome de usuário indisponível');
  }
  for (const social of dto.socials ?? []) {
    const error = socialUrlError(social.network, social.url);
    if (error) throw new BadRequestException(`${social.network}: ${error}`);
  }
}

// Only the fields that were sent; empty pixel ids are dropped.
export function profileChanges(dto: ProfileInput) {
  const { name, photoURL, template, title, about, username, socials, pixels } =
    dto;
  const clean = pixels
    ? Object.fromEntries(Object.entries(pixels).filter(([, v]) => v))
    : undefined;

  return Object.fromEntries(
    Object.entries({
      name,
      photoURL,
      template,
      title,
      about,
      username,
      socials,
      pixels: clean,
    }).filter(([, value]) => value !== undefined),
  );
}

export function isDuplicateKey(error: unknown) {
  return (error as { code?: number })?.code === 11000;
}
