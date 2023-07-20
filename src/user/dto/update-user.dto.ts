// import { PartialType } from '@nestjs/mapped-types';
// import { CreateUserDto } from './create-user.dto';

// export class UpdateUserDto extends PartialType(CreateUserDto) {}
import { User, Link } from '@prisma/client';

export class UpdateUserDto {
    readonly name?: string
    readonly photoURL?: string
    readonly template?: string
    readonly title?: string
    readonly about?: string
    readonly links?: string[]
}
