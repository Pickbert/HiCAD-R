import { describe, expect, it } from 'vitest';
import { buildExportPreview } from './exportPreview.js';
import type { WorkerMesh } from './mesh.js';

describe('buildExportPreview', () => {
  it('reports export unit, triangle count, mesh volume, and estimated file size', () => {
    const mesh: WorkerMesh = {
      material: 'cad-blue',
      color: [0.2, 0.5, 1],
      positions: new Float32Array([0, 0, 0, 10, 0, 0, 0, 20, 0, 0, 0, 30]),
      normals: new Float32Array([0, 0, -1, 0, 0, -1, 0, 0, -1, 1, 1, 1]),
      indices: new Uint32Array([0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3])
    };

    const preview = buildExportPreview([mesh], 'stl');

    expect(preview.format).toBe('STL');
    expect(preview.unit).toBe('mm');
    expect(preview.triangleCount).toBe(4);
    expect(preview.volumeMm3).toBeCloseTo(1000);
    expect(preview.volumeLabel).toBe('1.00 cm³');
    expect(preview.estimatedSizeLabel).toMatch(/KB|B/);
  });

  it('falls back to the bounding box volume when mesh volume is unavailable', () => {
    const mesh: WorkerMesh = {
      material: 'cad-blue',
      color: [0.2, 0.5, 1],
      positions: new Float32Array([0, 0, 0, 10, 20, 30]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1]),
      indices: new Uint32Array([])
    };

    const preview = buildExportPreview([mesh], 'obj');

    expect(preview.format).toBe('OBJ');
    expect(preview.volumeMm3).toBe(6000);
    expect(preview.volumeSource).toBe('bounding-box');
  });
});
