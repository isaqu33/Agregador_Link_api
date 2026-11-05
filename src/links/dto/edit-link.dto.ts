import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class EditLinkDto {
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
