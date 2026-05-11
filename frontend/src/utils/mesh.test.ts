import { describe, expect, it } from 'vitest';
import { buildGeometryFromWorkerMesh, meshToObj, meshToStl } from './mesh.js';

describe('mesh utilities', () => {
  it('creates geometry and real STL/OBJ output from worker mesh buffers', () => {
    const mesh = {
      material: 'gold',
      color: [1, 0.75, 0.1] as [number, number, number],
      positions: new Float32Array([0, 0, 0, 10, 0, 0, 0, 10, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      indices: new Uint32Array([0, 1, 2])
    };

    const geometry = buildGeometryFromWorkerMesh(mesh);

    expect(geometry.getAttribute('position').count).toBe(3);
    expect(meshToStl([mesh], 'triangle')).toContain('solid triangle');
    expect(meshToObj([mesh], 'triangle')).toContain('v 10 0 0');
  });
});
