import { Body, Controller, Get, HttpCode, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { JwtAuthGuard } from '../jwt/jwt-auth.guard';
import { CaptureLeadDto, DeleteLeadDto } from './dto/lead.dto';
import { LeadsService } from './leads.service';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  // Public: a visitor submits the e-mail form of a page
  @Post()
  @HttpCode(200)
  @Throttle(5, 60)
  capture(@Body() dto: CaptureLeadDto) {
    return this.leads.capture(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@Req() req, @Query('pageId') pageId?: string) {
    return this.leads.list(req.user.sub, pageId);
  }

  @Get('export')
  @UseGuards(JwtAuthGuard)
  async export(@Req() req, @Res() res: Response, @Query('pageId') pageId?: string) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="contatos.csv"');
    res.send(await this.leads.exportCsv(req.user.sub, pageId));
  }

  @Post('delete')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  remove(@Req() req, @Body() dto: DeleteLeadDto) {
    return this.leads.remove(req.user.sub, dto.id);
  }
}
