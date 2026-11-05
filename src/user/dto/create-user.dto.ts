export class CreateUserDto {
  readonly name: string;
  readonly email: string;
  // absent for accounts created through an OAuth provider (they have no password)
  readonly passwordHash?: string;
  readonly emailVerified?: boolean;
}
