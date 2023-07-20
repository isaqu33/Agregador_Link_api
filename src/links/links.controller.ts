import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { LinksService } from './links.service';
import { CreateLinkDto } from './dto/create-link.dto';
import { UpdateLinkDto } from './dto/update-link.dto';
import { JwtAuthGuard } from 'src/jwt/jwt-auth.guard';

@Controller('links')
export class LinksController {
  constructor(private readonly linksService: LinksService) { }

  @Post("addLink")
  @UseGuards(JwtAuthGuard)
  createNewLink(@Req() req) {
    const email = req.user.username;
    const Data = req.body;

    console.log(Data)

    return this.linksService.createlink(email, Data)
  }

  @Get("getDataUser/:id")
  getData(@Req() req, @Param() params) {

    const userId = req.body;

    const Params = params.id

    console.log(Params)

    // console.log(userId.id)
    return this.linksService.findAllDataUserById(Params);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.linksService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateLinkDto: UpdateLinkDto) {
    return this.linksService.update(+id, updateLinkDto);
  }

  @Post('deletLink')
  @UseGuards(JwtAuthGuard)
  removeLink(@Req() req) {
    const email = req.user.username;
    const idlink = req.body;

    console.log(req.body)

    return this.linksService.removelink(email, idlink.idlink)
  }

  @Post('editActivet')
  // @UseGuards(JwtAuthGuard)
  editarAtivo(@Req() req) {
    // const email = req.user.username;
    // const idlink = req.body;

    const Data = req.body;

    console.log(Data)
    console.log(Data.id)
    console.log(Data.activation)




    return this.linksService.updateActive(Data.id, Data.activation)
  }
}
