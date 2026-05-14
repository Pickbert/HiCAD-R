import { describe, expect, it } from 'vitest';
import {
  buildGeometryFromWorkerMesh,
  computeMeshStats,
  mergeWorkerMeshesByMaterial,
  meshToObj,
  meshToStl
} from './mesh.js';

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

  it('computes mesh stats and merges same-material worker buffers', () => {
    const left = {
      material: 'steel',
      color: [0.5, 0.5, 0.5] as [number, number, number],
      partIds: ['part-1'],
      positions: new Float32Array([0, 0, 0, 10, 0, 0, 0, 10, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      indices: new Uint32Array([0, 1, 2])
    };
    const right = {
      material: 'steel',
      color: [0.5, 0.5, 0.5] as [number, number, number],
      partIds: ['part-2'],
      positions: new Float32Array([10, 10, 0, 20, 10, 0, 10, 20, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      indices: new Uint32Array([0, 1, 2])
    };

    const merged = mergeWorkerMeshesByMaterial([left, right]);
    const stats = computeMeshStats(merged);

    expect(merged).toHaveLength(1);
    expect(merged[0].indices).toEqual(new Uint32Array([0, 1, 2, 3, 4, 5]));
    expect(merged[0].partIds).toEqual(['part-1', 'part-2']);
    expect(stats).toMatchObject({
      triangleCount: 2,
      vertexCount: 6,
      meshCount: 1,
      boundingBox: { width: 20, depth: 20, height: 0 }
    });
  });
});
