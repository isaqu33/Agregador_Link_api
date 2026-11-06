import { IntersectionType } from '@nestjs/mapped-types';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { LINK_TYPES } from '../../common/link-rules';
import { LinkOptionsDto, PageRefDto } from './link-options.dto';

class CreateLinkBase {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  // validated against `type` in LinksService (http/https, mailto:, tel:, Pix key — never javascript:)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  link?: string;

  @IsIn(LINK_TYPES)
  type: string;
}

export class CreateLinkDto extends IntersectionType(
  CreateLinkBase,
  IntersectionType(LinkOptionsDto, PageRefDto),
) {}
