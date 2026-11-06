import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../jwt/jwt-auth.guard';
import { clientIp } from '../common/app-throttler.guard';
import { Response } from 'express';
import { AnalyticsService } from './analytics.service';
import { TrackClickDto, TrackViewDto } from './dto/track.dto';

const visitor = clientIp;

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post('view')
  @Throttle(60, 60)
  @HttpCode(200)
  view(@Req() req, @Body() dto: TrackViewDto) {
    return this.analytics.trackView(
      visitor(req),
      dto.profile,
      req.headers['user-agent'],
      dto.referrer,
    );
  }

  @Post('click')
  @Throttle(60, 60)
  @HttpCode(200)
  click(@Req() req, @Body() dto: TrackClickDto) {
    return this.analytics.trackClick(visitor(req), dto.linkId);
  }

  // GET /analytics/stream (text/event-stream): events `view` and `click` of the logged user's page
  @Sse('stream')
  @UseGuards(JwtAuthGuard)
  stream(@Req() req) {
    return this.analytics.stream(req.user.sub);
  }

  @Get('summary')
  @UseGuards(JwtAuthGuard)
  summary(
    @Req() req,
    @Query('days') days?: string,
    @Query('pageId') pageId?: string,
  ) {
    return this.analytics.summary(req.user.sub, clampDays(days), pageId);
  }

  @Get('export')
  @UseGuards(JwtAuthGuard)
  async export(
    @Req() req,
    @Res() res: Response,
    @Query('days') days?: string,
    @Query('kind') kind?: string,
    @Query('pageId') pageId?: string,
  ) {
    const k = kind === 'links' ? 'links' : 'daily';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="analytics-${k}.csv"`,
    );
    res.send(
      await this.analytics.exportCsv(req.user.sub, clampDays(days), k, pageId),
    );
  }
}

function clampDays(days?: string) {
  return Math.min(Math.max(parseInt(days ?? '30', 10) || 30, 1), 90);
}
