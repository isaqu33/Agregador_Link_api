import { PrismaService } from './../DataBase/prisma.service';
import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from '@prisma/client';

@Injectable()
export class UserService {

  constructor(private prisma: PrismaService) { }

  async findOne(email): Promise<User | undefined> {

    return await this.prisma.user.findUnique({
      where: {
        email: email
      },
      include:{
        links: true
      }
    })
  }

  async createNewUser(Data: CreateUserDto): Promise<any> {

    const { name, email } = Data

    await this.prisma.user.create({

      data: {

        name,
        email,


      }
    })
  }

  async editProfireUser(email, Data: UpdateUserDto | any): Promise<any> {

    return await this.prisma.user.update({
      where: {
        email: email
      },
      data: {
        
        ...Data
        
      }
    })

  }








}
