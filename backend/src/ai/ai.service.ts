import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import type { AiProvider, AiStreamEvent } from '@hicad/shared';
import { JsonDatabaseService } from '../database/json-database.service.js';
import { nowIso } from '../domain.js';
import { summarizeCode } from './codegen.js';
import type { AiAdapter } from './adapters/types.js';
import { DeepSeekAdapter } from './adapters/deepseek.adapter.js';
import { OpenAiAdapter } from './adapters/openai.adapter.js';
import { QwenAdapter } from './adapters/qwen.adapter.js';
import { createGenerateEvents } from './ai-pipeline.js';
import { validateCadCodeSafety } from './cad-code-safety.js';
import { consumeDailyQuota } from '../users/quota.js';

@Injectable()
export class AiService {
  constructor(
    private readonly config: ConfigService,
    private readonly db: JsonDatabaseService
  ) {}

  streamGenerate(prompt: string, userId?: string, provider?: AiProvider, model?: string): Observable<MessageEvent> {
    const selectedProvider = provider ?? this.getProvider();
    const selectedModel = model ?? this.getModel(selectedProvider);
    const events = createGenerateEvents({
      prompt,
      provider: selectedProvider,
      model: selectedModel,
      adapter: this.createAdapter(selectedProvider),
      timeoutMs: Number(this.config.get('AI_TIMEOUT_MS') ?? 60_000)
    });
    return this.streamAsyncEvents(
      this.withAiQuota(userId, events),
      async (events) => {
        const code = [...events].reverse().find((event) => event.type === 'code')?.code;
        if (code) {
          await this.db.mutate((state) => {
            state.aiHistory.push({
              id: crypto.randomUUID(),
              userId,
              provider: `${selectedProvider}:${events.find((event) => event.type === 'code')?.source ?? 'provider'}`,
              prompt,
              code,
              createdAt: nowIso()
            });
          });
        }
      }
    );
  }

  streamModify(prompt: string, currentCode: string, userId?: string): Observable<MessageEvent> {
    const parameters = summarizeCode(currentCode).parameters;
    const note = `// AI 修改请求: ${prompt.replace(/\r?\n/g, ' ')}\n`;
    const code = validateCadCodeSafety(currentCode.startsWith('// AI 修改请求') ? currentCode : `${note}${currentCode}`);
    return this.streamEvents(
      [
        { type: 'start', provider: this.getProvider(), message: '开始修改当前 CAD 代码' },
        { type: 'delta', delta: `识别到 ${parameters.length} 个参数，已保留参数协议。\n` },
        { type: 'code', code },
        { type: 'done', message: '修改完成' }
      ],
      async () => {
        await this.db.mutate((state) => {
          state.aiHistory.push({
            id: crypto.randomUUID(),
            userId,
            provider: this.getProvider(),
            prompt,
            code,
            createdAt: nowIso()
          });
        });
      }
    );
  }

  async modify(prompt: string, currentCode: string, userId?: string) {
    const code = validateCadCodeSafety(currentCode.startsWith('// AI 修改请求') ? currentCode : `// AI 修改请求: ${prompt.replace(/\r?\n/g, ' ')}\n${currentCode}`);
    await this.db.mutate((state) => {
      state.aiHistory.push({
        id: crypto.randomUUID(),
        userId,
        provider: this.getProvider(),
        prompt,
        code,
        createdAt: nowIso()
      });
    });
    return { code, summary: summarizeCode(code) };
  }

  history(userId?: string) {
    return this.db.data.aiHistory.filter((entry) => !userId || entry.userId === userId).slice(-50).reverse();
  }

  private getProvider(): AiProvider {
    const provider = this.config.get<string>('AI_ADAPTER') ?? 'deepseek';
    return provider === 'openai' || provider === 'qwen' ? provider : 'deepseek';
  }

  private getModel(provider: AiProvider): string {
    if (provider === 'openai') return this.config.get('OPENAI_MODEL') ?? 'gpt-4o';
    if (provider === 'qwen') return this.config.get('QWEN_MODEL') ?? 'qwen-plus';
    return this.config.get('DEEPSEEK_MODEL') ?? 'deepseek-v4-pro';
  }

  private createAdapter(provider: AiProvider): AiAdapter | undefined {
    const timeoutMs = Number(this.config.get('AI_TIMEOUT_MS') ?? 60_000);
    if (provider === 'deepseek') {
      const apiKey = this.config.get<string>('DEEPSEEK_API_KEY');
      return apiKey
        ? new DeepSeekAdapter({
            apiKey,
            baseUrl: this.config.get('DEEPSEEK_BASE_URL') ?? 'https://api.deepseek.com',
            model: this.getModel(provider),
            timeoutMs,
            maxRetries: Number(this.config.get('AI_MAX_RETRIES') ?? 3)
          })
        : undefined;
    }
    if (provider === 'openai') {
      const apiKey = this.config.get<string>('OPENAI_API_KEY');
      return apiKey
        ? new OpenAiAdapter({
            apiKey,
            baseUrl: this.config.get('OPENAI_BASE_URL') ?? 'https://api.openai.com/v1',
            model: this.getModel(provider),
            timeoutMs
          })
        : undefined;
    }
    const apiKey = this.config.get<string>('QWEN_API_KEY');
    return apiKey
      ? new QwenAdapter({
          apiKey,
          baseUrl: this.config.get('QWEN_BASE_URL') ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1',
          model: this.getModel(provider),
          timeoutMs
        })
      : undefined;
  }

  private streamEvents(events: AiStreamEvent[], afterDone?: () => Promise<void>): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      let index = 0;
      const timer = setInterval(() => {
        const event = events[index++];
        if (!event) {
          clearInterval(timer);
          afterDone?.().catch((error) => subscriber.error(error));
          subscriber.complete();
          return;
        }
        subscriber.next({ data: event } as MessageEvent);
      }, 80);
      return () => clearInterval(timer);
    });
  }

  private streamAsyncEvents(generator: AsyncGenerator<AiStreamEvent>, afterDone?: (events: AiStreamEvent[]) => Promise<void>): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      const events: AiStreamEvent[] = [];
      let cancelled = false;
      void (async () => {
        try {
          for await (const event of generator) {
            if (cancelled) return;
            events.push(event);
            subscriber.next({ data: event } as MessageEvent);
          }
          await afterDone?.(events);
          subscriber.complete();
        } catch (error) {
          subscriber.error(error);
        }
      })();
      return () => {
        cancelled = true;
      };
    });
  }

  private async *withAiQuota(userId: string | undefined, events: AsyncGenerator<AiStreamEvent>): AsyncGenerator<AiStreamEvent> {
    if (userId) {
      const user = this.db.data.users.find((entry) => entry.id === userId);
      if (user) {
        try {
          await this.db.mutate((state) => consumeDailyQuota(state, user, 'aiCalls'));
        } catch (error) {
          yield { type: 'error', message: error instanceof Error ? error.message : 'AI quota exceeded', source: 'fallback' };
          yield { type: 'done', message: 'AI quota rejected' };
          return;
        }
      }
    }
    yield* events;
  }
}

function chunkText(text: string): AiStreamEvent[] {
  const chunks = text.match(/.{1,18}/g) ?? [];
  return chunks.map((delta) => ({ type: 'delta', delta }));
}
