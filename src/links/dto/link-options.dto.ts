import {
  IsBoolean,
  IsDateString,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

// Optional extras shared by create and edit. `null` clears a field on edit.
export class LinkOptionsDto {
  // a /media path of the owner (checked in the service)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  thumbnail?: string | null;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsDateString()
  startAt?: string | null;

  @IsOptional()
  @IsDateString()
  endAt?: string | null;

  // YouTube/Spotify player instead of a button
  @IsOptional()
  @IsBoolean()
  embed?: boolean;

  // sets (or changes) the access password of the link
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(72)
  password?: string;

  // removes the password
  @IsOptional()
  @IsBoolean()
  removePassword?: boolean;
}

export class PageRefDto {
  // extra page the link belongs to; omitted = main page
  @IsOptional()
  @IsMongoId()
  pageId?: string;
}
