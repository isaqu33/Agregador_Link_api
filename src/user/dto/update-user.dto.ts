import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { SOCIAL_NETWORKS } from '../../common/link-rules';

export class SocialDto {
  @IsIn(SOCIAL_NETWORKS)
  network: string;

  // checked per network in UserService (http(s) or mailto:)
  @IsString()
  @MaxLength(500)
  url: string;
}

export class PixelsDto {
  // Meta Pixel id (digits); empty string removes it
  @IsOptional()
  @IsString()
  @Matches(/^(\d{5,20})?$/, {
    message: 'Meta Pixel: apenas números (5 a 20 dígitos)',
  })
  meta?: string;

  // Google Analytics 4 measurement id (G-XXXXXXX); empty string removes it
  @IsOptional()
  @IsString()
  @Matches(/^(G-[A-Z0-9]{4,15})?$/, {
    message: 'Google Analytics: use o formato G-XXXXXXXXXX',
  })
  ga?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoURL?: string;

  // JSON string: { cor, formato, fonte, botao, texto, fundoMidia, marca }
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  template?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  about?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @Matches(/^[a-z0-9][a-z0-9_.]{2,29}$/, {
    message:
      'Usuário: 3 a 30 caracteres (letras minúsculas, números, _ e .), começando por letra ou número',
  })
  username?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => SocialDto)
  socials?: SocialDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PixelsDto)
  pixels?: PixelsDto;
}
