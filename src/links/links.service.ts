import { Link } from '@prisma/client';
// import { User } from './../user/entities/user.entity';


import { Injectable } from '@nestjs/common';
import { CreateLinkDto } from './dto/create-link.dto';
import { UpdateLinkDto } from './dto/update-link.dto';


import { PrismaService } from './../DataBase/prisma.service';
import { User } from '@prisma/client';
// import { Link } from './entities/link.entity';

@Injectable()
export class LinksService {

  constructor(private prisma: PrismaService,) { }

  create(createLinkDto: CreateLinkDto) {
    return 'This action adds a new link';
  }

  async createlink(email, Data: CreateLinkDto): Promise<any> {
    const linkCreated = await this.prisma.link.create({
      data: {

        ...Data,

        User: {
          connect: {
            email
          }
        },

      },

      include: {
        User: true,
      },
    })

    return linkCreated;

  }

  async removelink(email, idlink: string): Promise<any> {
    let linkdeleted = await this.prisma.link.delete({
      where: {
        id: idlink
      }
    })

    return linkdeleted;
  }

  async findAllDataUserById(UserId: string): Promise<any> {
    const dataUser = await this.prisma.user.findUnique({
      where: {
        id: UserId
      },
      include: {

        links: true
      }

    })

    const { name, email, photoURL, template, title, about, links } = dataUser

    return dataUser
  }

  async updateActive(LinkId: string, activation: Boolean): Promise<any> {
    const result = await this.prisma.link.update({
      where: {
        id: LinkId,
      },
      data: {
        isActivit: activation as boolean,
      },
    })

    return result
  }

  findOne(id: number) {
    return `This action returns a #${id} link`;
  }

  update(id: number, updateLinkDto: UpdateLinkDto) {
    return `This action updates a #${id} link`;
  }


}
