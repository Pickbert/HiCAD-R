import { booleans, colors, geometries, primitives, transforms } from '@jscad/modeling';
import type { WorkerMesh } from '../utils/mesh.js';

interface WorkerRequest {
  requestId: number;
  code: string;
  maxCodeBytes?: number;
}

interface WorkerSuccess {
  requestId: number;
  ok: true;
  elapsedMs: number;
  meshes: WorkerMesh[];
}

interface WorkerFailure {
  requestId: number;
  ok: false;
  error: {
    code: string;
    message: string;
    hint: string;
  };
}

const blockedPattern = /\b(fetch|XMLHttpRequest|WebSocket|importScripts|localStorage|sessionStorage|indexedDB|document|window|globalThis|eval|Function)\b|\bimport\s*\(/;

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const startedAt = performance.now();
  const { requestId, code, maxCodeBytes = 200000 } = event.data;
  try {
    validateCode(code, maxCodeBytes);
    const result = executeJscad(code);
    const meshes = geometriesToMeshes(result, materialFromComment(code));
    const response: WorkerSuccess = {
      requestId,
      ok: true,
      elapsedMs: Math.round(performance.now() - startedAt),
      meshes
    };
    (self as any).postMessage(response, meshes.flatMap((mesh) => [mesh.positions.buffer, mesh.normals.buffer, mesh.indices.buffer]));
  } catch (error) {
    const response: WorkerFailure = {
      requestId,
      ok: false,
      error: toStructuredError(error)
    };
    self.postMessage(response);
  }
};

function validateCode(code: string, maxCodeBytes: number) {
  if (typeof code !== 'string' || code.trim().length === 0) {
    throw Object.assign(new Error('CAD code is empty'), { code: 'EMPTY_CODE', hint: '请输入或生成一段 JSCAD 代码。' });
  }
  if (new Blob([code]).size > maxCodeBytes) {
    throw Object.assign(new Error('CAD code is too large'), { code: 'CODE_TOO_LARGE', hint: '请减少模型复杂度或拆分模型。' });
  }
  const blocked = blockedPattern.exec(code);
  if (blocked) {
    throw Object.assign(new Error(`Blocked unsafe token: ${blocked[0]}`), { code: 'UNSAFE_CODE', hint: '模型代码不能访问网络、存储或浏览器全局对象。' });
  }
}

function executeJscad(code: string): unknown {
  const module = { exports: {} as Record<string, unknown> };
  const scope = {
    ...primitives,
    ...booleans,
    ...transforms,
    colorize: colors.colorize,
    module,
    exports: module.exports
  };
  const fn = new Function(...Object.keys(scope), `${code}\n; return module.exports.main ? module.exports.main() : (typeof main === 'function' ? main() : undefined);`);
  const result = fn(...Object.values(scope));
  if (!result) {
    throw Object.assign(new Error('JSCAD code did not return geometry'), { code: 'NO_GEOMETRY', hint: '请确认代码导出或定义了 main() 并返回几何体。' });
  }
  return result;
}

function geometriesToMeshes(result: unknown, fallbackMaterial: string): WorkerMesh[] {
  const geometriesList = flattenGeometries(result);
  const groups = new Map<string, { color: [number, number, number]; positions: number[]; normals: number[]; indices: number[] }>();
  for (const geometry of geometriesList) {
    const polygons = geometries.geom3.toPolygons(geometry as any);
    for (const polygon of polygons as any[]) {
      const color = normalizeColor(polygon.color) ?? materialColor(fallbackMaterial);
      const material = colorToMaterial(color, fallbackMaterial);
      const key = `${material}:${color.join(',')}`;
      const group = groups.get(key) ?? { color, positions: [], normals: [], indices: [] };
      const baseIndex = group.positions.length / 3;
      const normal = polygonNormal(polygon.vertices);
      for (const vertex of polygon.vertices) {
        group.positions.push(vertex[0], vertex[1], vertex[2]);
        group.normals.push(normal[0], normal[1], normal[2]);
      }
      for (let i = 1; i < polygon.vertices.length - 1; i += 1) {
        group.indices.push(baseIndex, baseIndex + i, baseIndex + i + 1);
      }
      groups.set(key, group);
    }
  }
  const meshes = [...groups.entries()].map(([key, group]) => ({
    material: key.split(':')[0],
    color: group.color,
    positions: new Float32Array(group.positions),
    normals: new Float32Array(group.normals),
    indices: new Uint32Array(group.indices)
  }));
  if (meshes.length === 0) {
    throw Object.assign(new Error('No polygons were produced'), { code: 'EMPTY_GEOMETRY', hint: '模型生成了空几何，请检查布尔运算或参数。' });
  }
  return meshes;
}

function flattenGeometries(result: unknown): unknown[] {
  if (Array.isArray(result)) return result.flatMap(flattenGeometries);
  return [result];
}

function polygonNormal(vertices: number[][]): [number, number, number] {
  const a = vertices[0];
  const b = vertices[1];
  const c = vertices[2];
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
  const length = Math.hypot(cross[0], cross[1], cross[2]) || 1;
  return [cross[0] / length, cross[1] / length, cross[2] / length];
}

function normalizeColor(color: unknown): [number, number, number] | undefined {
  if (!Array.isArray(color) || color.length < 3) return undefined;
  return [Number(color[0]), Number(color[1]), Number(color[2])];
}

function materialFromComment(code: string): string {
  return /@material:\s*([A-Za-z0-9_-]+)/.exec(code)?.[1] ?? 'cad-blue';
}

function materialColor(material: string): [number, number, number] {
  return (
    {
      'cad-blue': [0.31, 0.63, 1],
      silver: [0.84, 0.87, 0.91],
      gold: [0.91, 0.72, 0.29],
      copper: [0.78, 0.47, 0.23],
      ceramic: [0.94, 0.95, 0.96],
      glass: [0.6, 0.87, 1],
      neon: [0.13, 1, 0.67],
      'matte-black': [0.11, 0.12, 0.16],
      white: [1, 1, 1],
      steel: [0.55, 0.6, 0.65]
    }[material] ?? [0.31, 0.63, 1]
  ) as [number, number, number];
}

function colorToMaterial(color: [number, number, number], fallback: string): string {
  const known = materialColor(fallback);
  return color.every((value, index) => Math.abs(value - known[index]) < 0.001) ? fallback : 'colorized';
}

function toStructuredError(error: unknown) {
  const anyError = error as { code?: string; hint?: string; message?: string };
  return {
    code: anyError.code ?? 'JSCAD_ERROR',
    message: anyError.message ?? String(error),
    hint: anyError.hint ?? '请检查 JSCAD 代码语法和 main() 返回值。'
  };
}
