import 'reflect-metadata';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Template } from '@hicad/shared';
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/app-setup.js';

export interface HttpTestApp {
  app: INestApplication;
  request: ReturnType<typeof request>;
  dataDir: string;
  close: () => Promise<void>;
}

export interface HttpTestAppOptions {
  templates?: Template[];
  frontendDir?: string;
}

export async function createHttpTestApp(input: Template[] | HttpTestAppOptions = []): Promise<HttpTestApp> {
  const options = Array.isArray(input) ? { templates: input } : input;
  const dataDir = await mkdtemp(join(tmpdir(), 'hicad-http-'));
  await writeFile(join(dataDir, 'templates.json'), JSON.stringify({ templates: options.templates ?? [] }), 'utf8');
  process.env.DATA_DIR = dataDir;
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-with-at-least-thirty-two-characters';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-with-at-least-thirty-two-characters';
  process.env.PAY_CALLBACK_SECRET = 'test-payment-secret-with-at-least-thirty-two-characters';
  process.env.DEV_ACTIVATION_CODE = 'e2e-code';
  process.env.AI_ADAPTER = 'deepseek';
  delete process.env.DEEPSEEK_API_KEY;

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApplication(app, { frontendDir: options.frontendDir });
  await app.init();

  return {
    app,
    request: request(app.getHttpServer()),
    dataDir,
    close: () => app.close()
  };
}

export async function registerUser(http: HttpTestApp, email: string) {
  const response = await http.request.post('/api/auth/register').send({
    email,
    password: 'password123',
    activationCode: 'e2e-code',
    displayName: email.split('@')[0]
  });
  return response.body as {
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string; role: 'admin' | 'user' };
  };
}

export function bearer(token: string) {
  return `Bearer ${token}`;
}

export function parseSseEvents(payload: string) {
  return payload
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => JSON.parse(line.replace(/^data:\s*/, '')));
}

export function collectSse(res: NodeJS.ReadableStream, callback: (error: Error | null, body?: string) => void) {
  let payload = '';
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    payload += chunk;
  });
  res.on('end', () => callback(null, payload));
}
