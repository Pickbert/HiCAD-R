import { describe, expect, it } from 'vitest';
import { buildPreviewSummary } from './cad.js';

describe('buildPreviewSummary', () => {
  it('derives dimensions and material from CAD comments and parameters', () => {
    const summary = buildPreviewSummary(`// @material: gold
const boxWidth = 80 // 宽度 unit:mm min:10 max:200
const boxDepth = 40 // 深度 unit:mm min:10 max:200
const boxHeight = 20 // 高度 unit:mm min:10 max:200
`);

    expect(summary.material).toBe('gold');
    expect(summary.dimensions).toEqual({ width: 80, depth: 40, height: 20 });
  });
});
