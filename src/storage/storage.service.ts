import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
// looping page backgrounds: short clips only
export const MAX_VIDEO_BYTES = 15 * 1024 * 1024;

// Blob names this service generates: <userId>/<uuid>.<ext> (userId is a Mongo ObjectId)
const BLOB_NAME = /^[0-9a-f]{24}\/[0-9a-f-]{36}\.(jpg|png|webp|gif|mp4|webm)$/;

export class RangeNotSatisfiableException extends HttpException {
  constructor(readonly size: number) {
    super('Range Not Satisfiable', HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE);
  }
}

@Injectable()
export class StorageService implements OnModuleInit {
  private container: ContainerClient;

  constructor(private config: ConfigService) {
    const connectionString = this.config.get<string>(
      'AZURE_STORAGE_CONNECTION_STRING',
    );
    if (!connectionString) {
      throw new Error('AZURE_STORAGE_CONNECTION_STRING is not set');
    }

    this.container = BlobServiceClient.fromConnectionString(
      connectionString,
    ).getContainerClient(
      this.config.get<string>('AZURE_IMAGES_CONTAINER') ?? 'agregador-images',
    );
  }

  async onModuleInit() {
    await this.container.createIfNotExists();
  }

  async uploadImage(
    userId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    const extension = EXTENSION_BY_MIME[file?.mimetype];
    if (!extension) {
      throw new BadRequestException(
        'Envie uma imagem (JPEG, PNG, WebP, GIF) ou um vídeo (MP4, WebM)',
      );
    }
    if (!file.mimetype.startsWith('video/') && file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException('A imagem pode ter no máximo 5 MB');
    }

    const name = `${userId}/${randomUUID()}.${extension}`;
    await this.container.getBlockBlobClient(name).uploadData(file.buffer, {
      blobHTTPHeaders: { blobContentType: file.mimetype },
    });

    return name;
  }

  /** `range` is the already parsed byte range; browsers need it to seek and to play video on Safari. */
  async download(
    name: string,
    range?: { start: number; end?: number },
  ): Promise<{
    stream: Readable;
    contentType: string;
    size: number;
    start: number;
    end: number;
  }> {
    if (!BLOB_NAME.test(name)) throw new NotFoundException();

    const blob = this.container.getBlobClient(name);
    let size: number;
    let contentType: string;
    try {
      const props = await blob.getProperties();
      size = props.contentLength;
      contentType = props.contentType ?? 'application/octet-stream';
    } catch {
      throw new NotFoundException();
    }

    const start = range ? range.start : 0;
    const end = Math.min(range?.end ?? size - 1, size - 1);
    if (start > end || start >= size) {
      throw new RangeNotSatisfiableException(size);
    }
    const response = await blob.download(start, end - start + 1);
    return {
      stream: response.readableStreamBody as Readable,
      contentType,
      size,
      start,
      end,
    };
  }
}
