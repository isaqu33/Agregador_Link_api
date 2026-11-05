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

// Shared by the main page (User) and extra pages: same fields, same rules.
export function checkProfileInput(dto: ProfileInput) {
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
  const { name, photoURL, template, title, about, username, socials, pixels } = dto;
  const clean = pixels
    ? Object.fromEntries(Object.entries(pixels).filter(([, v]) => v))
    : undefined;

  return Object.fromEntries(
    Object.entries({ name, photoURL, template, title, about, username, socials, pixels: clean }).filter(
      ([, value]) => value !== undefined,
    ),
  );
}

export function isDuplicateKey(error: unknown) {
  return (error as { code?: number })?.code === 11000;
}
