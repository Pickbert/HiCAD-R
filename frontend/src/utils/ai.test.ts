import { describe, expect, it } from 'vitest';
import { buildCodeDiffSummary, mergeAiStreamEvent } from './ai.js';

describe('AI UI helpers', () => {
  it('merges streaming delta chunks into one assistant message', () => {
    const messages = mergeAiStreamEvent([], { type: 'delta', delta: '正在分析' });
    const updated = mergeAiStreamEvent(messages, { type: 'delta', delta: '参数。' });

    expect(updated).toEqual([{ role: 'assistant', text: '正在分析参数。', streaming: true }]);
  });

  it('summarizes code changes for diff/apply review', () => {
    const before = 'const width = 10\nfunction main() { return cuboid({ size: [width, 10, 10] }) }\n';
    const after = '// AI 修改请求: 加宽\nconst width = 20\nfunction main() { return cuboid({ size: [width, 10, 10] }) }\n';

    expect(buildCodeDiffSummary(before, after)).toEqual({
      added: 2,
      removed: 1,
      changed: 1,
      preview: ['+ // AI 修改请求: 加宽', '+ const width = 20', '- const width = 10']
    });
  });
});
