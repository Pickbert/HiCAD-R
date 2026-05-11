import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, buildMarketPath, fileToBase64Payload } from './api.js';

describe('api helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refreshes an expired access token once and retries the original request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'UNAUTHORIZED', message: 'expired' }), { status: 401 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accessToken: 'access-2',
            refreshToken: 'refresh-2',
            user: { id: 'u1', email: 'demo@hicad.local', displayName: 'Demo', role: 'user', tier: 'pro', createdAt: '', updatedAt: '' }
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const refreshed: string[] = [];

    const result = await apiFetch<{ ok: true }>(
      '/models',
      {},
      {
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        onRefresh: (next) => refreshed.push(next.accessToken)
      }
    );

    expect(result.ok).toBe(true);
    expect(refreshed).toEqual(['access-2']);
    expect(fetchMock.mock.calls[2][0]).toBe('/api/models');
    expect((fetchMock.mock.calls[2][1]?.headers as Headers).get('authorization')).toBe('Bearer access-2');
  });

  it('builds market query paths with search, category, tags, and sorting', () => {
    expect(buildMarketPath({ q: 'robot arm', category: 'mechanical', tag: 'featured', sort: 'popular' })).toBe(
      '/models/market?q=robot+arm&category=mechanical&tag=featured&sort=popular'
    );
  });

  it('creates an STL import payload with Base64 data', async () => {
    const file = new File(['solid box\nendsolid box\n'], 'box.stl', { type: 'model/stl' });

    await expect(fileToBase64Payload(file, 'Box')).resolves.toEqual({
      title: 'Box',
      filename: 'box.stl',
      dataBase64: 'c29saWQgYm94CmVuZHNvbGlkIGJveAo=',
      tags: ['STL']
    });
  });
});
