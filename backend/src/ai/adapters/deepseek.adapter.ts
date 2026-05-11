import { OpenAiCompatibleAdapter } from './openai-compatible.adapter.js';
import type { AdapterOptions } from './types.js';

export class DeepSeekAdapter extends OpenAiCompatibleAdapter {
  constructor(options: Partial<AdapterOptions> & Pick<AdapterOptions, 'apiKey'>) {
    super({
      provider: 'deepseek',
      baseUrl: options.baseUrl ?? 'https://api.deepseek.com',
      model: options.model ?? 'deepseek-v4-pro',
      maxRetries: options.maxRetries ?? 3,
      retryDelaysMs: options.retryDelaysMs ?? [2000, 4000, 8000],
      timeoutMs: options.timeoutMs,
      fetchImpl: options.fetchImpl,
      wait: options.wait,
      apiKey: options.apiKey
    });
  }
}
