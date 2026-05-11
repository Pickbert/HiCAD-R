import type { CadModel, Template } from '@hicad/shared';

const apiBase = '/api';

export interface AuthState {
  accessToken?: string;
  refreshToken?: string;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}, auth: AuthState = {}): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(auth.accessToken ? { authorization: `Bearer ${auth.accessToken}` } : {}),
      ...options.headers
    }
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
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

export function fetchMarket() {
  return apiFetch<CadModel[]>('/models/market');
}

export function fetchTemplates() {
  return apiFetch<Template[]>('/templates');
}
