import type { User } from '@hicad/shared';

export const AUTH_STORAGE_KEY = 'hicad.auth.v1';

export interface StoredAuth {
  accessToken: string;
  refreshToken: string;
  user?: User;
}

export function loadStoredAuth(storage = defaultStorage()): StoredAuth | undefined {
  if (!storage) return undefined;
  try {
    const raw = storage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<StoredAuth>;
    if (!parsed.accessToken || !parsed.refreshToken) return undefined;
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      user: parsed.user
    };
  } catch {
    return undefined;
  }
}

export function saveStoredAuth(auth: StoredAuth, storage = defaultStorage()): void {
  storage?.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
}

export function clearStoredAuth(storage = defaultStorage()): void {
  storage?.removeItem(AUTH_STORAGE_KEY);
}

function defaultStorage(): Storage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}
