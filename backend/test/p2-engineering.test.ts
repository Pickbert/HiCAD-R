import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import { ApiExceptionFilter } from '../src/common/http-exception.filter.js';
import { redactSensitiveData } from '../src/security/redaction.js';
import { createHttpTestApp, type HttpTestApp } from './http-test-app.js';

describe('P2 engineering hardening', () => {
  let http: HttpTestApp | undefined;

  afterEach(async () => {
    await http?.close();
    http = undefined;
  });

  it('serves Swagger UI and OpenAPI JSON under the API prefix', async () => {
    http = await createHttpTestApp();

    const docs = await http.request.get('/api/docs').expect(200);
    expect(docs.text).toContain('swagger-ui');

    const schema = await http.request.get('/api/openapi.json').expect(200);
    expect(schema.body.openapi).toMatch(/^3\./);
    expect(Object.keys(schema.body.paths)).toEqual(expect.arrayContaining(['/api/auth/register', '/api/models']));
  });

  it('applies immutable cache headers to hashed assets and no-cache to index HTML', async () => {
    const frontendDir = join(await createTempDir(), 'frontend-dist');
    await mkdir(join(frontendDir, 'assets'), { recursive: true });
    await writeFile(join(frontendDir, 'index.html'), '<!doctype html><div id="app"></div>', 'utf8');
    await writeFile(join(frontendDir, 'assets', 'index-abc123.js'), 'console.log("asset")', 'utf8');
    http = await createHttpTestApp({ frontendDir });

    const asset = await http.request.get('/assets/index-abc123.js').expect(200);
    expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable');

    const index = await http.request.get('/').expect(200);
    expect(index.headers['cache-control']).toBe('no-cache');
  });

  it('redacts secrets from structured logs and free-form strings', () => {
    const redacted = redactSensitiveData({
      authorization: 'Bearer header.payload.signature',
      DEEPSEEK_API_KEY: 'sk-deepseek-secret',
      refreshToken: 'refresh-token-secret',
      nested: {
        signature: 'payment-signature-secret',
        message: 'failed with OPENAI_API_KEY=sk-openai-secret and jwt eyJhbGciOi.fake.signature'
      }
    });

    const serialized = JSON.stringify(redacted);
    expect(serialized).not.toContain('header.payload.signature');
    expect(serialized).not.toContain('sk-deepseek-secret');
    expect(serialized).not.toContain('refresh-token-secret');
    expect(serialized).not.toContain('payment-signature-secret');
    expect(serialized).not.toContain('sk-openai-secret');
    expect(serialized).toContain('[REDACTED]');
  });

  it('hides non-HTTP exception messages in production responses', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const filter = new ApiExceptionFilter();

    filter.catch(new Error('crashed with QWEN_API_KEY=sk-qwen-secret'), {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ requestId: 'req-1' })
      })
    } as any);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        requestId: 'req-1'
      })
    );
    expect(JSON.stringify(json.mock.calls[0][0])).not.toContain('sk-qwen-secret');
    process.env.NODE_ENV = previousNodeEnv;
  });
});

async function createTempDir() {
  const { mkdtemp } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  return mkdtemp(join(tmpdir(), 'hicad-static-'));
}
