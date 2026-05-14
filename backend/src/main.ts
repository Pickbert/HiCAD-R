import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { assertSecureRuntimeConfig } from './security/runtime-security.js';
import { configureApplication } from './app-setup.js';

async function bootstrap() {
  assertSecureRuntimeConfig({
    nodeEnv: process.env.NODE_ENV,
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    payCallbackSecret: process.env.PAY_CALLBACK_SECRET
  });

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: false });
  configureApplication(app);

  await app.listen(Number(process.env.PORT ?? 3000), process.env.HOST ?? '127.0.0.1');
}

void bootstrap();
