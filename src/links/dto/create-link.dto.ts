import { IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class CreateLinkDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  // http/https only: blocks javascript: and data: URLs on the public page
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2000)
  link: string;

  @IsString()
  @MaxLength(50)
  type: string;
}
