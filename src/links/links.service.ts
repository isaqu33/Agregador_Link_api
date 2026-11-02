import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateLinkDto } from './dto/create-link.dto';
import { PrismaService } from './../DataBase/prisma.service';

@Injectable()
export class LinksService {
  constructor(private prisma: PrismaService) {}

  async createlink(email: string, { name, link, type }: CreateLinkDto) {
    return await this.prisma.link.create({
      data: {
        name,
        link,
        type,
        User: {
          connect: {
            email,
          },
        },
      },
    });
  }

  async removelink(email: string, idlink: string) {
    await this.findOwnedLink(email, idlink);

    return await this.prisma.link.delete({
      where: {
        id: idlink,
      },
    });
  }

  // Public page: no email, and inactive links stay hidden.
  async findAllDataUserById(UserId: string) {
    const dataUser = await this.prisma.user.findUnique({
      where: {
        id: UserId,
      },
      select: {
        id: true,
        name: true,
        photoURL: true,
        template: true,
        title: true,
        about: true,
        links: { where: { isActivit: true } },
      },
    });

    if (!dataUser) throw new NotFoundException('Usuário não encontrado');

    return dataUser;
  }

  async updateActive(email: string, LinkId: string, activation: boolean) {
    await this.findOwnedLink(email, LinkId);

    return await this.prisma.link.update({
      where: {
        id: LinkId,
      },
      data: {
        isActivit: activation,
      },
    });
  }

  // A link that belongs to someone else is reported as missing, so ids can't be probed.
  private async findOwnedLink(email: string, id: string) {
    const link = await this.prisma.link.findFirst({
      where: { id, User: { email } },
    });

    if (!link) throw new NotFoundException('Link não encontrado');

    return link;
  }
}
