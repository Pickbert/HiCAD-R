import 'reflect-metadata';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthService } from '../src/auth/auth.service.js';
import { JsonDatabaseService } from '../src/database/json-database.service.js';
import { ModelService } from '../src/models/model.service.js';

describe('HiCAD HTTP workflow', () => {
  let auth: AuthService;
  let models: ModelService;

  beforeEach(async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hicad-e2e-'));
    await writeFile(join(dir, 'templates.json'), JSON.stringify({ templates: [] }), 'utf8');
    process.env.DATA_DIR = dir;
    process.env.NODE_ENV = 'test';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-with-at-least-thirty-two-characters';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-with-at-least-thirty-two-characters';
    process.env.PAY_CALLBACK_SECRET = 'test-payment-secret-with-at-least-thirty-two-characters';
    process.env.DEV_ACTIVATION_CODE = 'e2e-code';

    const config = new ConfigService(process.env);
    const db = new JsonDatabaseService(config);
    await db.onModuleInit();
    auth = new AuthService(db, new JwtService(), config);
    models = new ModelService(db);
  });

  it('registers, logs in, saves, publishes, shares, and reads a public share', async () => {
    const register = await auth.register({ email: 'e2e@example.com', password: 'password123', activationCode: 'e2e-code' });

    const login = await auth.login({ email: 'e2e@example.com', password: 'password123' });
    const token = login.accessToken;
    expect(token).toBeTruthy();

    const user2 = await auth.register({ email: 'viewer@example.com', password: 'password123', activationCode: 'e2e-code' });
    expect(user2.user.role).toBe('user');

    const created = await models.create(register.user as any, { title: 'E2E Box', code: 'const boxWidth = 10 // 宽度 unit:mm min:1 max:20' });

    const published = await models.publish(register.user as any, created.id);
    const share = await models.share(register.user as any, created.id);
    const shared = models.getShare(share.token);

    expect(register.user.role).toBe('admin');
    expect(published.visibility).toBe('public');
    expect(shared.id).toBe(created.id);
  });
});
