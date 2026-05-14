import type { AiProvider, AiStreamEvent } from '@hicad/shared';
import type { AiAdapter } from './adapters/types.js';
import { generateJscadCode, inferDesignSpec } from './codegen.js';
import { validateCadCodeSafety } from './cad-code-safety.js';
import { buildDesignMessages, inferPromptKind, parseDesignSpecJson } from './prompts.js';
import { redactSensitiveData } from '../security/redaction.js';

export interface GeneratePipelineOptions {
  prompt: string;
  provider: AiProvider;
  model: string;
  adapter?: AiAdapter;
  timeoutMs?: number;
}

export async function* createGenerateEvents(options: GeneratePipelineOptions): AsyncGenerator<AiStreamEvent> {
  yield {
    type: 'start',
    provider: options.provider,
    model: options.model,
    message: `请求 ${options.provider}:${options.model} 解析设计意图`
  };
  try {
    if (!options.adapter) {
      throw new Error(`${options.provider} adapter is not configured`);
    }
    const retryEvents: AiStreamEvent[] = [];
    const spec = parseDesignSpecJson(
      JSON.stringify(
        await options.adapter.completeJson({
          model: options.model,
          timeoutMs: options.timeoutMs,
          messages: buildDesignMessages(options.prompt, inferPromptKind(options.prompt)),
          onRetry: (event) => {
            retryEvents.push({
              type: 'retry',
              provider: event.provider,
              model: event.model,
              attempt: event.attempt,
              maxAttempts: event.maxAttempts,
              retryInMs: event.retryInMs,
              statusCode: event.statusCode,
              message: event.message
            });
          }
        })
      )
    );
    for (const event of retryEvents) yield event;
    const code = validateCadCodeSafety(generateJscadCode(spec));
    yield { type: 'spec', provider: options.provider, model: options.model, spec, source: 'provider' };
    yield {
      type: 'code',
      provider: options.provider,
      model: options.model,
      code,
      source: 'provider',
      message: 'provider-codegen'
    };
    yield { type: 'done', provider: options.provider, model: options.model, message: '生成完成' };
  } catch (error) {
    yield* createFallbackGenerateEvents({
      prompt: options.prompt,
      provider: options.provider,
      model: options.model,
      error
    });
  }
}

export async function* createFallbackGenerateEvents(options: {
  prompt: string;
  provider: AiProvider;
  model: string;
  error: unknown;
}): AsyncGenerator<AiStreamEvent> {
  const message = redactSensitiveData(options.error instanceof Error ? options.error.message : String(options.error));
  yield { type: 'error', provider: options.provider, model: options.model, message };
  yield {
    type: 'fallback',
    provider: options.provider,
    model: options.model,
    source: 'fallback',
    message: '真实模型不可用，使用本地确定性 codegen fallback'
  };
  const spec = inferDesignSpec(options.prompt);
  const code = validateCadCodeSafety(generateJscadCode(spec));
  yield { type: 'spec', provider: options.provider, model: options.model, spec, source: 'fallback' };
  yield {
    type: 'code',
    provider: options.provider,
    model: options.model,
    code,
    source: 'fallback',
    message: 'fallback-local-codegen'
  };
  yield {
    type: 'done',
    provider: options.provider,
    model: options.model,
    source: 'fallback',
    message: 'fallback 生成完成'
  };
}

export async function collectAiEvents(generator: AsyncGenerator<AiStreamEvent>): Promise<AiStreamEvent[]> {
  const events: AiStreamEvent[] = [];
  for await (const event of generator) {
    events.push(event);
  }
  return events;
}
