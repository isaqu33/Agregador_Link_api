import { JwtAuthGuard } from './../jwt/jwt-auth.guard';
import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  findeMe(@Req() req) {
    return this.userService.findMe(req.user.sub);
  }

  @Post('editProfile')
  @UseGuards(JwtAuthGuard)
  editStile(@Req() req, @Body() data: UpdateUserDto) {
    return this.userService.editProfireUser(req.user.sub, data);
  }
}
