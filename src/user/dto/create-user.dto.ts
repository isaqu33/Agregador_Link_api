export class CreateUserDto {
  readonly name: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly emailVerified?: boolean;
}
