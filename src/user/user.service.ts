import { PrismaService } from './../DataBase/prisma.service';
import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  // Includes the password hash: for internal use only, never return this to a client.
  async findOne(email: string): Promise<(User & { links: unknown[] }) | null> {
    return await this.prisma.user.findUnique({
      where: {
        email: email,
      },
      include: {
        links: true,
      },
    });
  }

  async findMe(email: string) {
    const user = await this.findOne(email);
    if (!user) return null;

    return this.withoutPassword(user);
  }

  async createNewUser({
    name,
    email,
    passwordHash,
  }: CreateUserDto): Promise<User> {
    return await this.prisma.user.create({
      data: {
        name,
        email,
        password: passwordHash,
      },
    });
  }

  async editProfireUser(
    email: string,
    { name, photoURL, template, title, about }: UpdateUserDto,
  ) {
    const user = await this.prisma.user.update({
      where: {
        email: email,
      },
      data: { name, photoURL, template, title, about },
    });

    return this.withoutPassword(user);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private withoutPassword<T extends { password: string | null }>({
    password: _password,
    ...rest
  }: T) {
    return rest;
  }
}
