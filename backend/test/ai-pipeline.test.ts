import { describe, expect, it } from 'vitest';
import { collectAiEvents, createFallbackGenerateEvents } from '../src/ai/ai-pipeline.js';
import { buildDesignMessages, parseDesignSpecJson } from '../src/ai/prompts.js';
import { validateCadCodeSafety } from '../src/ai/cad-code-safety.js';

describe('AI pipeline', () => {
  it('marks local codegen as fallback after adapter failure', async () => {
    const events = await collectAiEvents(
      createFallbackGenerateEvents({
        prompt: '生成一个 50x30x20mm 的盒子',
        provider: 'deepseek',
        model: 'deepseek-v4-pro',
        error: new Error('provider unavailable')
      })
    );

    expect(events.map((event) => event.type)).toContain('fallback');
    expect(events.find((event) => event.type === 'code')?.message).toContain('fallback');
  });

  it('builds prompt messages and validates strict design spec JSON', () => {
    const messages = buildDesignMessages('机械臂 120x80x60mm', 'arm');
    expect(messages[0].content).toContain('strict JSON');
    expect(
      parseDesignSpecJson('{"kind":"arm","title":"机械臂","width":120,"depth":80,"height":60,"material":"steel"}')
    ).toMatchObject({
      kind: 'arm',
      width: 120
    });
    expect(() => parseDesignSpecJson('{"kind":"unknown"}')).toThrow(/Invalid design spec/);
  });

  it('rejects CAD code with network, persistence, or dynamic side effects', () => {
    expect(() => validateCadCodeSafety('fetch("https://example.com")')).toThrow(/blocked token/);
    expect(() => validateCadCodeSafety('localStorage.setItem("x", "y")')).toThrow(/blocked token/);
    expect(() => validateCadCodeSafety('importScripts("x.js")')).toThrow(/blocked token/);
    expect(() =>
      validateCadCodeSafety('// @material: gold\nconst boxWidth = 10 // 宽度 unit:mm min:1 max:20')
    ).not.toThrow();
  });
});
