import { OpenAiCompatibleAdapter } from './openai-compatible.adapter.js';
import type { AdapterOptions } from './types.js';

export class QwenAdapter extends OpenAiCompatibleAdapter {
  constructor(options: Partial<AdapterOptions> & Pick<AdapterOptions, 'apiKey'>) {
    super({
      provider: 'qwen',
      baseUrl: options.baseUrl ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: options.model ?? 'qwen-plus',
      maxRetries: options.maxRetries ?? 1,
      timeoutMs: options.timeoutMs,
      fetchImpl: options.fetchImpl,
      wait: options.wait,
      apiKey: options.apiKey
    });
  }
}
