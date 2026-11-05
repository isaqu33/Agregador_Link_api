import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class TrackViewDto {
  // user id or @username of the page that was opened
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  profile: string;

  // document.referrer of the visitor (only the host is stored)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  referrer?: string;
}

export class TrackClickDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  linkId: string;
}
