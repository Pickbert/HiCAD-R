import { expect, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

export interface AuthPayload {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    role: 'admin' | 'user';
    tier: 'free' | 'pro' | 'team';
    createdAt: string;
    updatedAt: string;
  };
}

export async function registerUser(request: APIRequestContext, prefix: string): Promise<AuthPayload> {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@e2e.local`;
  const response = await request.post('/api/auth/register', {
    data: {
      email,
      password: 'password123',
      activationCode: 'e2e-code',
      displayName: prefix
    }
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as AuthPayload;
}

export async function registerOrdinaryUser(request: APIRequestContext): Promise<AuthPayload> {
  await registerUser(request, 'seed-admin');
  const user = await registerUser(request, 'ordinary-user');
  expect(user.user.role).toBe('user');
  return user;
}

export async function installAuth(page: Page, auth: AuthPayload) {
  await page.addInitScript((payload) => {
    window.localStorage.setItem('hicad.auth.v1', JSON.stringify(payload));
  }, auth);
}

export function screenshotPath(testInfo: TestInfo, fileName: string) {
  const output = join(testInfo.project.outputDir, 'screenshots', fileName);
  mkdirSync(dirname(output), { recursive: true });
  return output;
}
