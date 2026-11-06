import { IntersectionType } from '@nestjs/mapped-types';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { LinkOptionsDto } from './link-options.dto';

class EditLinkBase {
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  // validated against the stored type in LinksService
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  link?: string;
}

export class EditLinkDto extends IntersectionType(
  EditLinkBase,
  LinkOptionsDto,
) {}
