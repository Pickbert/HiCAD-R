import { describe, expect, it } from 'vitest';
import { clearStoredAuth, loadStoredAuth, saveStoredAuth } from './auth.js';

function memoryStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => Array.from(entries.keys())[index] ?? null,
    removeItem: (key) => entries.delete(key),
    setItem: (key, value) => entries.set(key, value)
  };
}

describe('auth persistence helpers', () => {
  it('stores and restores the current user and tokens', () => {
    const storage = memoryStorage();

    saveStoredAuth(
      {
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        user: {
          id: 'u1',
          email: 'demo@hicad.local',
          displayName: 'Demo',
          role: 'admin',
          tier: 'pro',
          createdAt: '2026-05-11T00:00:00.000Z',
          updatedAt: '2026-05-11T00:00:00.000Z'
        }
      },
      storage
    );

    expect(loadStoredAuth(storage)?.accessToken).toBe('access-1');
    expect(loadStoredAuth(storage)?.user?.role).toBe('admin');

    clearStoredAuth(storage);
    expect(loadStoredAuth(storage)).toBeUndefined();
  });
});
