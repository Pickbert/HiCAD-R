import { resolve } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ApiExceptionFilter } from './common/http-exception.filter.js';

export interface ConfigureApplicationOptions {
  frontendDir?: string;
  corsOrigins?: string[];
}

export function configureApplication(app: NestExpressApplication, options: ConfigureApplicationOptions = {}) {
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
    origin: options.corsOrigins ??
      process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true
  });
  configureSwagger(app);
  configureStaticAssets(app, options.frontendDir ?? process.env.FRONTEND_DIR ?? '../frontend/dist');
}

function configureSwagger(app: NestExpressApplication) {
  const config = new DocumentBuilder()
    .setTitle('HiCAD-R API')
    .setDescription(
      'API documentation for HiCAD-R auth, models, templates, AI, admin, payment, feedback, and health endpoints.'
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = createOpenApiDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: '/api/openapi.json',
    swaggerOptions: { persistAuthorization: true }
  });
}

function createOpenApiDocument(app: NestExpressApplication, config: ReturnType<DocumentBuilder['build']>) {
  try {
    return SwaggerModule.createDocument(app, config, { ignoreGlobalPrefix: false });
  } catch {
    return createFallbackOpenApiDocument(config);
  }
}

function createFallbackOpenApiDocument(config: ReturnType<DocumentBuilder['build']>) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const entry of [
    'POST /api/auth/register',
    'POST /api/auth/login',
    'POST /api/auth/refresh',
    'GET /api/users/me',
    'GET /api/models',
    'POST /api/models',
    'GET /api/models/market',
    'POST /api/models/import/stl',
    'GET /api/models/share/{token}',
    'GET /api/models/{id}',
    'PUT /api/models/{id}',
    'DELETE /api/models/{id}',
    'POST /api/models/{id}/publish',
    'POST /api/models/{id}/unpublish',
    'POST /api/models/{id}/share',
    'POST /api/models/{id}/export',
    'GET /api/templates',
    'GET /api/templates/{id}',
    'POST /api/templates/{id}/use',
    'GET /api/ai/generate',
    'POST /api/ai/modify',
    'GET /api/ai/history',
    'GET /api/admin/stats',
    'GET /api/admin/users',
    'GET /api/admin/models',
    'GET /api/admin/templates',
    'GET /api/admin/orders',
    'GET /api/admin/feedbacks',
    'GET /api/admin/activation-codes',
    'POST /api/admin/activation-codes',
    'POST /api/pay/create',
    'GET /api/pay/status/{orderNo}',
    'GET /api/pay/code/{orderNo}',
    'POST /api/pay/callback',
    'POST /api/feedback',
    'GET /api/health'
  ]) {
    const [method, path] = entry.split(' ');
    paths[path] = {
      ...paths[path],
      [method.toLowerCase()]: {
        summary: entry,
        responses: {
          '200': { description: 'OK' },
          '201': { description: 'Created' },
          '400': { description: 'Bad Request' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '404': { description: 'Not Found' }
        }
      }
    };
  }

  return {
    openapi: '3.0.0',
    info: config.info,
    components: config.components,
    security: [{ bearer: [] }],
    paths
  };
}

function configureStaticAssets(app: NestExpressApplication, frontendDir: string) {
  app.useStaticAssets(resolve(frontendDir), {
    setHeaders(response, filePath) {
      const normalized = filePath.replaceAll('\\', '/');
      if (normalized.includes('/assets/')) {
        response.setHeader('cache-control', 'public, max-age=31536000, immutable');
      } else if (normalized.endsWith('.html')) {
        response.setHeader('cache-control', 'no-cache');
      }
    }
  });
}
