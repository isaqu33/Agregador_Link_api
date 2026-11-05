import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../jwt/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import { TrackClickDto, TrackViewDto } from './dto/track.dto';

function visitor(req: any): string {
  // the Next proxy forwards the browser IP in x-forwarded-for
  const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
  return forwarded || req.ip || 'unknown';
}

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post('view')
  @HttpCode(200)
  view(@Req() req, @Body() dto: TrackViewDto) {
    return this.analytics.trackView(visitor(req), dto.profile);
  }

  @Post('click')
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
  summary(@Req() req, @Query('days') days?: string) {
    const n = Math.min(Math.max(parseInt(days ?? '30', 10) || 30, 1), 90);
    return this.analytics.summary(req.user.sub, n);
  }
}
