import { JwtAuthGuard } from './../jwt/jwt-auth.guard';
import { Controller, Get, Post, Body, Patch, Param, Delete, Req, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) { }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  findeMe(@Req() req) {

    return this.userService.findOne(req.user.username)

  }

  @Post("editProfile")
  @UseGuards(JwtAuthGuard)
  editStile(@Req() req) {
    console.log("acessou aqui ")

    const email = req.user.username;
    const Data = req.body;
    console.log(email)
    console.log(Data)


    return this.userService.editProfireUser(email, Data)
  }
}
