import { OpenAiCompatibleAdapter } from './openai-compatible.adapter.js';
import type { AdapterOptions } from './types.js';

export class OpenAiAdapter extends OpenAiCompatibleAdapter {
  constructor(options: Partial<AdapterOptions> & Pick<AdapterOptions, 'apiKey'>) {
    super({
      provider: 'openai',
      baseUrl: options.baseUrl ?? 'https://api.openai.com/v1',
      model: options.model ?? 'gpt-4o',
      maxRetries: options.maxRetries ?? 1,
      timeoutMs: options.timeoutMs,
      fetchImpl: options.fetchImpl,
      wait: options.wait,
      apiKey: options.apiKey
    });
  }
}
