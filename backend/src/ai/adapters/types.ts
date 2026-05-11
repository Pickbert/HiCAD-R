import type { AiProvider } from '@hicad/shared';

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiRetryEvent {
  provider: AiProvider;
  model: string;
  attempt: number;
  maxAttempts: number;
  retryInMs: number;
  statusCode?: number;
  message: string;
}

export interface AiCompleteJsonRequest {
  messages: AiMessage[];
  model?: string;
  timeoutMs?: number;
  onRetry?: (event: AiRetryEvent) => void;
}

export interface AiStreamTextRequest extends AiCompleteJsonRequest {
  onDelta?: (delta: string) => void;
}

export interface AiAdapter {
  provider: AiProvider;
  model: string;
  completeJson<T = unknown>(request: AiCompleteJsonRequest): Promise<T>;
  streamText(request: AiStreamTextRequest): AsyncGenerator<string>;
  healthCheck(): Promise<{ ok: boolean; provider: AiProvider; model: string; message?: string }>;
}

export interface AdapterOptions {
  provider: AiProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelaysMs?: number[];
  fetchImpl?: typeof fetch;
  wait?: (ms: number) => Promise<void>;
}

export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly provider: AiProvider,
    readonly model: string,
    readonly statusCode?: number,
    readonly retryable = false
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}
