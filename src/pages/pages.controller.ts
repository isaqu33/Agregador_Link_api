import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../jwt/jwt-auth.guard';
import { CreatePageDto, DeletePageDto, EditPageDto } from './dto/page.dto';
import { PagesService } from './pages.service';

@Controller('pages')
@UseGuards(JwtAuthGuard)
export class PagesController {
  constructor(private readonly pages: PagesService) {}

  @Post('create')
  create(@Req() req, @Body() dto: CreatePageDto) {
    return this.pages.create(req.user.sub, dto);
  }

  @Post('edit')
  edit(@Req() req, @Body() dto: EditPageDto) {
    return this.pages.edit(req.user.sub, dto);
  }

  @Post('delete')
  remove(@Req() req, @Body() dto: DeletePageDto) {
    return this.pages.remove(req.user.sub, dto.id);
  }

  @Get(':id')
  findOne(@Req() req, @Param('id') id: string) {
    return this.pages.findOne(req.user.sub, id);
  }
}
