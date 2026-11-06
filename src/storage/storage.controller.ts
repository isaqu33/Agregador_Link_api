import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../jwt/jwt-auth.guard';
import { MAX_IMAGE_BYTES, StorageService } from './storage.service';

@ApiTags('storage')
@ApiBearerAuth()
@Controller('media')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
    }),
  )
  async upload(@Req() req, @UploadedFile() file: Express.Multer.File) {
    const name = await this.storage.uploadImage(req.user.sub, file);
    return { url: `/media/${name}` };
  }

  // Public: profile photos and link images are shown on the public page.
  @Get(':userId/:file')
  async read(
    @Param('userId') userId: string,
    @Param('file') file: string,
    @Res() res: Response,
  ) {
    const { stream, contentType } = await this.storage.download(
      `${userId}/${file}`,
    );

    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    stream.pipe(res);
  }
}
