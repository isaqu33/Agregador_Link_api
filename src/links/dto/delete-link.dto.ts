import { IsString } from 'class-validator';

export class DeleteLinkDto {
  @IsString()
  idlink: string;
}
