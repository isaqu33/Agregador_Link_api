import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  Controller,
  Get,
  Param,
  Post,
  Headers,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../jwt/jwt-auth.guard';
import {
  MAX_VIDEO_BYTES,
  RangeNotSatisfiableException,
  StorageService,
} from './storage.service';

@ApiTags('storage')
@ApiBearerAuth()
@Controller('media')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_VIDEO_BYTES, files: 1 },
    }),
  )
  async upload(@Req() req, @UploadedFile() file: Express.Multer.File) {
    const name = await this.storage.uploadImage(req.user.sub, file);
    return { url: `/media/${name}` };
  }

  // Public: profile photos, link images and page backgrounds are shown on the public page.
  @Get(':userId/:file')
  async read(
    @Param('userId') userId: string,
    @Param('file') file: string,
    @Headers('range') rangeHeader: string | undefined,
    @Res() res: Response,
  ) {
    const range = parseRange(rangeHeader);
    try {
      const { stream, contentType, size, start, end } =
        await this.storage.download(`${userId}/${file}`, range);

      res.setHeader('Content-Type', contentType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', end - start + 1);
      if (range) {
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      }
      stream.pipe(res);
    } catch (error) {
      if (error instanceof RangeNotSatisfiableException) {
        res.status(416).setHeader('Content-Range', `bytes */${error.size}`);
        res.end();
        return;
      }
      throw error;
    }
  }
}

/** Only the single-range form `bytes=start-end` / `bytes=start-` (what browsers send for media). */
export function parseRange(header?: string) {
  const match = /^bytes=(\d+)-(\d*)$/.exec(header ?? '');
  if (!match) return undefined;
  return {
    start: Number(match[1]),
    end: match[2] === '' ? undefined : Number(match[2]),
  };
}
