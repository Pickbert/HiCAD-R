import 'reflect-metadata';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { assertSecureRuntimeConfig } from './security/runtime-security.js';
import { ApiExceptionFilter } from './common/http-exception.filter.js';

async function bootstrap() {
  assertSecureRuntimeConfig({
    nodeEnv: process.env.NODE_ENV,
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    payCallbackSecret: process.env.PAY_CALLBACK_SECRET
  });

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: false });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true
  });
  app.useStaticAssets(resolve(process.env.FRONTEND_DIR ?? '../frontend/dist'));

  await app.listen(Number(process.env.PORT ?? 3000), process.env.HOST ?? '127.0.0.1');
}

void bootstrap();
