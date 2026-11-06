import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  // close Mongo/Redis and finish in-flight requests on SIGTERM/SIGINT
  app.enableShutdownHooks();

  // /media images are read by pages on another origin (the front), so keep CORP open
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  // explicit body limits (uploads go through multipart, not JSON)
  app.use(
    json({ limit: '100kb' }),
    urlencoded({ extended: true, limit: '100kb' }),
  );
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3071')
      .split(',')
      .map((o) => o.trim()),
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // API inventory (OWASP API9): off in production unless SWAGGER=true
  if (process.env.NODE_ENV !== 'production' || process.env.SWAGGER === 'true') {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('FaceLink API')
        .setDescription('Link aggregator API (Linktree style)')
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('docs', app, doc);
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
