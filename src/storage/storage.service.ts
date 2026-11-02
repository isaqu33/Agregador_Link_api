import {
  BadRequestException,
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
};

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Blob names this service generates: <userId>/<uuid>.<ext>
const BLOB_NAME = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|gif)$/;

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
      throw new BadRequestException('Envie uma imagem JPEG, PNG, WebP ou GIF');
    }

    const name = `${userId}/${randomUUID()}.${extension}`;
    await this.container.getBlockBlobClient(name).uploadData(file.buffer, {
      blobHTTPHeaders: { blobContentType: file.mimetype },
    });

    return name;
  }

  async download(
    name: string,
  ): Promise<{ stream: Readable; contentType: string }> {
    if (!BLOB_NAME.test(name)) throw new NotFoundException();

    const blob = this.container.getBlobClient(name);
    if (!(await blob.exists())) throw new NotFoundException();

    const response = await blob.download();
    return {
      stream: response.readableStreamBody as Readable,
      contentType: response.contentType ?? 'application/octet-stream',
    };
  }
}
