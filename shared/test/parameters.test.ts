import { describe, expect, it } from 'vitest';
import { applyCadParameters, parseCadParameters } from '../src/index.js';

describe('parseCadParameters', () => {
  it('extracts numeric top-level parameters from the comment protocol', () => {
    const code = `
const boxWidth = 50 // 箱体宽度 unit:mm min:10 max:100 step:5
let wallThickness = 2.5 // 壁厚 unit:mm min:1 max:8
const title = 'demo' // not numeric
`;

    expect(parseCadParameters(code)).toEqual([
      {
        name: 'boxWidth',
        label: '箱体宽度',
        value: 50,
        unit: 'mm',
        min: 10,
        max: 100,
        step: 5
      },
      {
        name: 'wallThickness',
        label: '壁厚',
        value: 2.5,
        unit: 'mm',
        min: 1,
        max: 8,
        step: 0.1
      }
    ]);
  });

  it('applies numeric parameter edits while preserving labels, units, and bounds', () => {
    const code = `
const boxWidth = 50 // 箱体宽度 unit:mm min:10 max:100 step:5
const wallThickness = 2.5 // 壁厚 unit:mm min:1 max:8
`;

    const nextCode = applyCadParameters(code, [
      { name: 'boxWidth', label: '箱体宽度', value: 75, unit: 'mm', min: 10, max: 100, step: 5 },
      { name: 'wallThickness', label: '壁厚', value: 3.75, unit: 'mm', min: 1, max: 8, step: 0.1 }
    ]);

    expect(nextCode).toContain('const boxWidth = 75 // 箱体宽度 unit:mm min:10 max:100 step:5');
    expect(nextCode).toContain('const wallThickness = 3.75 // 壁厚 unit:mm min:1 max:8');
  });
});
