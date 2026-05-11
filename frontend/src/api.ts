import type { AiProvider, CadModel, Template, User } from '@hicad/shared';

const apiBase = '/api';

export interface AuthState {
  accessToken?: string;
  refreshToken?: string;
  onRefresh?: (auth: AuthResponse) => void;
  onAuthExpired?: () => void;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface MarketQuery {
  q?: string;
  category?: string;
  tag?: string;
  sort?: 'latest' | 'popular' | 'mostUsed' | 'featured';
}

export interface ImportStlPayload {
  title: string;
  filename: string;
  dataBase64: string;
  tags: string[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}, auth: AuthState = {}, didRefresh = false): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, buildRequest(options, auth.accessToken));
  if (response.status === 401 && auth.refreshToken && !didRefresh && path !== '/auth/refresh') {
    try {
      const refreshed = await refresh(auth.refreshToken);
      auth.onRefresh?.(refreshed);
      return apiFetch<T>(path, options, { ...auth, accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken }, true);
    } catch {
      auth.onAuthExpired?.();
    }
  }
  if (!response.ok) {
    throw await createApiError(response);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export interface ClosableStream {
  close(): void;
}

export function streamGenerate(prompt: string, provider: string, auth: AuthState, onEvent: (event: any) => void): ClosableStream {
  const controller = new AbortController();
  const url = `${apiBase}/ai/generate?prompt=${encodeURIComponent(prompt)}&provider=${encodeURIComponent(provider)}`;
  void fetch(url, {
    signal: controller.signal,
    headers: auth.accessToken ? { authorization: `Bearer ${auth.accessToken}` } : undefined
  })
    .then(async (response) => {
      if (!response.ok || !response.body) throw new Error('AI 流式连接失败');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          const dataLine = part
            .split('\n')
            .find((line) => line.startsWith('data:'));
          if (!dataLine) continue;
          onEvent(JSON.parse(dataLine.slice(5).trim()));
        }
      }
    })
    .catch((error) => {
      if (controller.signal.aborted) return;
      onEvent({ type: 'error', message: error instanceof Error ? error.message : 'AI 流式连接中断' });
    });
  return { close: () => controller.abort() };
}

export function login(email: string, password: string) {
  return apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export function register(email: string, password: string, activationCode: string) {
  return apiFetch<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, activationCode }) });
}

export function refresh(refreshToken: string) {
  return apiFetch<AuthResponse>('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) });
}

export function me(auth: AuthState) {
  return apiFetch<User>('/users/me', {}, auth);
}

export function listMine(auth: AuthState) {
  return apiFetch<CadModel[]>('/models', {}, auth);
}

export function fetchMarket(query: MarketQuery = {}) {
  return apiFetch<CadModel[]>(buildMarketPath(query));
}

export function fetchTemplates() {
  return apiFetch<Template[]>('/templates');
}

export function fetchShare(token: string, auth: AuthState = {}) {
  return apiFetch<CadModel>(`/models/share/${encodeURIComponent(token)}`, {}, auth);
}

export function importStl(payload: ImportStlPayload, auth: AuthState) {
  return apiFetch<CadModel>('/models/import/stl', { method: 'POST', body: JSON.stringify(payload) }, auth);
}

export function modifyAi(prompt: string, code: string, auth: AuthState) {
  return apiFetch<{ code: string; summary: unknown }>('/ai/modify', { method: 'POST', body: JSON.stringify({ prompt, code }) }, auth);
}

export function fetchAiHistory(auth: AuthState) {
  return apiFetch<Array<{ id: string; prompt: string; code: string; provider: string; createdAt: string }>>('/ai/history', {}, auth);
}

export function fetchAdminResource<T>(resource: string, auth: AuthState) {
  return apiFetch<T>(`/admin/${resource.replace(/^\/+/, '')}`, {}, auth);
}

export function buildMarketPath(query: MarketQuery): string {
  const params = new URLSearchParams();
  if (query.q?.trim()) params.set('q', query.q.trim());
  if (query.category?.trim()) params.set('category', query.category.trim());
  if (query.tag?.trim()) params.set('tag', query.tag.trim());
  if (query.sort) params.set('sort', query.sort);
  const suffix = params.toString();
  return `/models/market${suffix ? `?${suffix}` : ''}`;
}

export async function fileToBase64Payload(file: File, title: string): Promise<ImportStlPayload> {
  return {
    title: title.trim() || file.name.replace(/\.stl$/i, '') || 'Imported STL',
    filename: file.name,
    dataBase64: arrayBufferToBase64(await file.arrayBuffer()),
    tags: ['STL']
  };
}

function buildRequest(options: RequestInit, accessToken?: string): RequestInit {
  const headers = new Headers(options.headers);
  if (!headers.has('content-type') && !(options.body instanceof FormData)) headers.set('content-type', 'application/json');
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
  return { ...options, headers };
}

async function createApiError(response: Response): Promise<ApiError> {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { message?: string; code?: string };
    return new ApiError(parsed.message ?? parsed.code ?? text, response.status, parsed);
  } catch {
    return new ApiError(text || `HTTP ${response.status}`, response.status);
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}
