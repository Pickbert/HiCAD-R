import { describe, expect, it } from 'vitest';
import { groupCadParameters, normalizeParameterValue, resetParameterDefaults } from './parameters.js';

const code = `const bodyWidth = 80 // 主体/宽度 unit:mm min:10 max:200 step:5
const bodyHeight = 30 // 主体/高度 unit:mm min:10 max:100 step:5
const wheelRadius = 12 // 轮子/半径 unit:mm min:5 max:50 step:1
`;

describe('parameter panel helpers', () => {
  it('groups parameters by label prefix', () => {
    expect(groupCadParameters(code).map((group) => [group.name, group.parameters.map((item) => item.name)])).toEqual([
      ['主体', ['bodyWidth', 'bodyHeight']],
      ['轮子', ['wheelRadius']]
    ]);
  });

  it('clamps invalid numeric input and resets to defaults', () => {
    expect(normalizeParameterValue({ min: 10, max: 200, step: 5, value: 80 }, 999)).toBe(200);
    expect(normalizeParameterValue({ min: 10, max: 200, step: 5, value: 80 }, Number.NaN)).toBe(80);
    expect(resetParameterDefaults(code)).toContain('const bodyWidth = 80');
  });
});
