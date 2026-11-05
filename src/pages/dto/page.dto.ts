import { IntersectionType } from '@nestjs/mapped-types';
import { IsMongoId, IsString, MaxLength, MinLength } from 'class-validator';
import { UpdateUserDto } from '../../user/dto/update-user.dto';

export class CreatePageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;
}

class PageIdDto {
  @IsMongoId()
  id: string;
}

// same editable fields as the main page (name = label of the page)
export class EditPageDto extends IntersectionType(PageIdDto, UpdateUserDto) {}

export class DeletePageDto extends PageIdDto {}
