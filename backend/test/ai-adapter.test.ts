import { describe, expect, it, vi } from 'vitest';
import { DeepSeekAdapter } from '../src/ai/adapters/deepseek.adapter.js';
import { createOpenAiCompatibleAdapter } from '../src/ai/adapters/openai-compatible.adapter.js';
import { redactSecrets } from '../src/ai/adapters/redaction.js';

describe('AI adapters', () => {
  it('retries DeepSeek retryable failures with 2s/4s/8s backoff', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(new Response('limited', { status: 429 }))
      .mockResolvedValueOnce(new Response('timeout', { status: 408 }))
      .mockResolvedValueOnce(
        Response.json({
          choices: [{ message: { content: '{"kind":"box","title":"ok","width":50,"depth":30,"height":20,"material":"cad-blue"}' } }]
        })
      );
    const waits: number[] = [];
    const adapter = new DeepSeekAdapter({
      apiKey: 'sk-deepseek-secret',
      fetchImpl: fetchMock,
      wait: (ms) => {
        waits.push(ms);
        return Promise.resolve();
      }
    });
    const retries: number[] = [];

    const json = await adapter.completeJson({
      messages: [{ role: 'user', content: 'box' }],
      onRetry: (event) => retries.push(event.retryInMs)
    });

    expect(json).toMatchObject({ kind: 'box', width: 50 });
    expect(waits).toEqual([2000, 4000, 8000]);
    expect(retries).toEqual([2000, 4000, 8000]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('builds OpenAI compatible requests for each provider without leaking secrets in logs', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        choices: [{ message: { content: '{"kind":"box","title":"ok","width":1,"depth":2,"height":3,"material":"gold"}' } }]
      })
    );
    const adapter = createOpenAiCompatibleAdapter({
      provider: 'qwen',
      apiKey: 'sk-qwen-secret',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: 'qwen-plus',
      fetchImpl: fetchMock
    });

    await adapter.completeJson({ messages: [{ role: 'user', content: 'hello' }] });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
    expect(JSON.parse(String(init.body))).toMatchObject({ model: 'qwen-plus' });
    expect(redactSecrets(JSON.stringify(init))).not.toContain('sk-qwen-secret');
  });
});
