import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { LINK_TYPES } from '../../common/link-rules';

export class CreateLinkDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  // validated against `type` in LinksService (http/https, mailto:, tel: — never javascript:)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  link?: string;

  @IsIn(LINK_TYPES)
  type: string;
}
