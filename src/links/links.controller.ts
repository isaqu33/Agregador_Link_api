import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { LinksService } from './links.service';
import { CreateLinkDto } from './dto/create-link.dto';
import { DeleteLinkDto } from './dto/delete-link.dto';
import { EditActiveDto } from './dto/edit-active.dto';
import { EditLinkDto } from './dto/edit-link.dto';
import { ReorderLinksDto } from './dto/reorder-links.dto';
import { JwtAuthGuard } from 'src/jwt/jwt-auth.guard';

@Controller('links')
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @Post('addLink')
  @UseGuards(JwtAuthGuard)
  createNewLink(@Req() req, @Body() data: CreateLinkDto) {
    return this.linksService.createlink(req.user.sub, data);
  }

  @Get('getDataUser/:id')
  getData(@Param('id') id: string) {
    return this.linksService.findAllDataUserById(id);
  }

  @Post('deletLink')
  @UseGuards(JwtAuthGuard)
  removeLink(@Req() req, @Body() data: DeleteLinkDto) {
    return this.linksService.removelink(req.user.sub, data.idlink);
  }

  @Post('editLink')
  @UseGuards(JwtAuthGuard)
  editarLink(@Req() req, @Body() data: EditLinkDto) {
    return this.linksService.updateLink(req.user.sub, data);
  }

  @Post('reorder')
  @UseGuards(JwtAuthGuard)
  reordenar(@Req() req, @Body() data: ReorderLinksDto) {
    return this.linksService.reorder(req.user.sub, data.ids);
  }

  @Post('editActivet')
  @UseGuards(JwtAuthGuard)
  editarAtivo(@Req() req, @Body() data: EditActiveDto) {
    return this.linksService.updateActive(
      req.user.sub,
      data.id,
      data.activation,
    );
  }
}
