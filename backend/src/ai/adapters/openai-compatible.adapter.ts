import type { AiProvider } from '@hicad/shared';
import {
  AiAdapter,
  AiCompleteJsonRequest,
  AiProviderError,
  AiRetryEvent,
  AiStreamTextRequest,
  AdapterOptions
} from './types.js';

const defaultRetryDelays = [2000, 4000, 8000];

export function createOpenAiCompatibleAdapter(options: AdapterOptions): AiAdapter {
  return new OpenAiCompatibleAdapter(options);
}

export class OpenAiCompatibleAdapter implements AiAdapter {
  readonly provider: AiProvider;
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryDelaysMs: number[];
  private readonly fetchImpl: typeof fetch;
  private readonly wait: (ms: number) => Promise<void>;

  constructor(options: AdapterOptions) {
    this.provider = options.provider;
    this.model = options.model;
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.maxRetries = options.maxRetries ?? 0;
    this.retryDelaysMs = options.retryDelaysMs ?? defaultRetryDelays;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.wait = options.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async completeJson<T = unknown>(request: AiCompleteJsonRequest): Promise<T> {
    const content = await this.completeText({ ...request, stream: false });
    try {
      return JSON.parse(extractJsonObject(content)) as T;
    } catch (error) {
      throw new AiProviderError(
        `Provider returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
        this.provider,
        this.model
      );
    }
  }

  async *streamText(request: AiStreamTextRequest): AsyncGenerator<string> {
    const text = await this.completeText(request);
    for (const chunk of text.match(/.{1,24}/gs) ?? []) {
      request.onDelta?.(chunk);
      yield chunk;
    }
  }

  async healthCheck() {
    if (!this.apiKey) {
      return { ok: false, provider: this.provider, model: this.model, message: 'API key is not configured' };
    }
    return { ok: true, provider: this.provider, model: this.model };
  }

  private async completeText(request: AiCompleteJsonRequest & { stream?: boolean }): Promise<string> {
    let attempt = 0;
    for (;;) {
      try {
        const response = await this.postChatCompletion(request);
        return readCompletionContent(response);
      } catch (error) {
        const providerError = normalizeError(error, this.provider, request.model ?? this.model);
        if (!providerError.retryable || attempt >= this.maxRetries) {
          throw providerError;
        }
        const retryInMs = this.retryDelaysMs[attempt] ?? this.retryDelaysMs.at(-1) ?? 8000;
        attempt += 1;
        const retryEvent: AiRetryEvent = {
          provider: this.provider,
          model: request.model ?? this.model,
          attempt,
          maxAttempts: this.maxRetries,
          retryInMs,
          statusCode: providerError.statusCode,
          message: providerError.message
        };
        request.onRetry?.(retryEvent);
        await this.wait(retryInMs);
      }
    }
  }

  private async postChatCompletion(request: AiCompleteJsonRequest): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs ?? this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: request.model ?? this.model,
          messages: request.messages,
          temperature: 0.1,
          response_format: { type: 'json_object' }
        }),
        signal: controller.signal
      });
      if (!response.ok) {
        throw new AiProviderError(
          `Provider returned HTTP ${response.status}`,
          this.provider,
          request.model ?? this.model,
          response.status,
          isRetryableStatus(response.status)
        );
      }
      return response.json();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new AiProviderError('Provider request timed out', this.provider, request.model ?? this.model, 408, true);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function isRetryableStatus(status: number | undefined): boolean {
  return status === 408 || status === 429 || status === 503 || Boolean(status && status >= 500);
}

function normalizeError(error: unknown, provider: AiProvider, model: string): AiProviderError {
  if (error instanceof AiProviderError) return error;
  return new AiProviderError(error instanceof Error ? error.message : String(error), provider, model);
}

function readCompletionContent(response: any): string {
  const content = response?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('Provider response did not include choices[0].message.content');
  }
  return content;
}

function extractJsonObject(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;
  const match = /\{[\s\S]*\}/.exec(trimmed);
  if (!match) throw new Error('No JSON object found');
  return match[0];
}
