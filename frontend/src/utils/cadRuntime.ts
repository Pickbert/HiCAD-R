import { booleans, colors, geometries, primitives, transforms } from '@jscad/modeling';
import { computeMeshStats, type MeshStats, type WorkerMesh } from './mesh.js';

export interface CadRuntimeRequest {
  code: string;
  maxCodeBytes?: number;
  maxTriangles?: number;
}

export interface CadPartNode {
  id: string;
  name: string;
  material: string;
  color: [number, number, number];
  triangleCount: number;
}

export interface CadRuntimeResult {
  meshes: WorkerMesh[];
  parts: CadPartNode[];
  stats: MeshStats;
  transferables: ArrayBuffer[];
}

export class CadRuntimeError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly hint: string
  ) {
    super(message);
    this.name = 'CadRuntimeError';
  }
}

const blockedPattern = /\b(fetch|XMLHttpRequest|WebSocket|importScripts|localStorage|sessionStorage|indexedDB|document|window|globalThis|eval|Function)\b|\bimport\s*\(/;

export function runCadRuntime({ code, maxCodeBytes = 200000, maxTriangles = 120000 }: CadRuntimeRequest): CadRuntimeResult {
  validateCode(code, maxCodeBytes);
  const result = executeJscad(code);
  const { meshes, parts } = geometriesToMeshes(result, materialFromComment(code));
  const stats = computeMeshStats(meshes);
  if (stats.triangleCount > maxTriangles) {
    throw new CadRuntimeError(
      'MODEL_TOO_COMPLEX',
      `Model triangle limit exceeded: ${stats.triangleCount}/${maxTriangles}`,
      '模型面数过高，已暂停自动渲染。请减少 segments、简化布尔运算，或手动继续一次渲染。'
    );
  }
  return {
    meshes,
    parts,
    stats,
    transferables: meshes.flatMap((mesh) => [mesh.positions.buffer, mesh.normals.buffer, mesh.indices.buffer]) as ArrayBuffer[]
  };
}

function validateCode(code: string, maxCodeBytes: number) {
  if (typeof code !== 'string' || code.trim().length === 0) {
    throw new CadRuntimeError('EMPTY_CODE', 'CAD code is empty', '请输入或生成一段 JSCAD 代码。');
  }
  if (new Blob([code]).size > maxCodeBytes) {
    throw new CadRuntimeError('CODE_TOO_LARGE', 'CAD code is too large', '请减少模型复杂度或拆分模型。');
  }
  const blocked = blockedPattern.exec(code);
  if (blocked) {
    throw new CadRuntimeError('UNSAFE_CODE', `Blocked unsafe token: ${blocked[0]}`, '模型代码不能访问网络、存储或浏览器全局对象。');
  }
}

function executeJscad(code: string): unknown {
  try {
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
      throw new CadRuntimeError('NO_GEOMETRY', 'JSCAD code did not return geometry', '请确认代码导出或定义了 main() 并返回几何体。');
    }
    return result;
  } catch (error) {
    if (error instanceof CadRuntimeError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new CadRuntimeError('JSCAD_ERROR', message, 'JSCAD main() 执行失败，请检查语法、参数和布尔运算。');
  }
}

function geometriesToMeshes(result: unknown, fallbackMaterial: string): { meshes: WorkerMesh[]; parts: CadPartNode[] } {
  const partInputs = flattenParts(result);
  const groups = new Map<string, { color: [number, number, number]; material: string; partIds: Set<string>; positions: number[]; normals: number[]; indices: number[] }>();
  const parts: CadPartNode[] = [];
  for (const part of partInputs) {
    const polygons = geometries.geom3.toPolygons(part.geometry as any);
    const geometryColor = normalizeColor((part.geometry as { color?: unknown }).color);
    let partTriangleCount = 0;
    let partColor = geometryColor ?? materialColor(fallbackMaterial);
    let partMaterial = geometryColor ? colorToMaterial(geometryColor, fallbackMaterial) : fallbackMaterial;
    for (const polygon of polygons as any[]) {
      const color = normalizeColor(polygon.color) ?? geometryColor ?? materialColor(fallbackMaterial);
      const material = colorToMaterial(color, fallbackMaterial);
      partColor = color;
      partMaterial = material;
      const key = `${material}:${color.join(',')}`;
      const group = groups.get(key) ?? { color, material, partIds: new Set<string>(), positions: [], normals: [], indices: [] };
      group.partIds.add(part.id);
      const baseIndex = group.positions.length / 3;
      const normal = polygonNormal(polygon.vertices);
      for (const vertex of polygon.vertices) {
        group.positions.push(vertex[0], vertex[1], vertex[2]);
        group.normals.push(normal[0], normal[1], normal[2]);
      }
      for (let i = 1; i < polygon.vertices.length - 1; i += 1) {
        group.indices.push(baseIndex, baseIndex + i, baseIndex + i + 1);
        partTriangleCount += 1;
      }
      groups.set(key, group);
    }
    parts.push({ id: part.id, name: part.name, material: partMaterial, color: partColor, triangleCount: partTriangleCount });
  }
  const meshes = [...groups.values()].map((group) => ({
    material: group.material,
    color: group.color,
    partIds: [...group.partIds],
    positions: new Float32Array(group.positions),
    normals: new Float32Array(group.normals),
    indices: new Uint32Array(group.indices)
  }));
  if (meshes.length === 0) {
    throw new CadRuntimeError('EMPTY_GEOMETRY', 'No polygons were produced', '模型生成了空几何，请检查布尔运算或参数。');
  }
  return { meshes, parts };
}

function flattenParts(result: unknown, prefix = 'part'): Array<{ id: string; name: string; geometry: unknown }> {
  if (Array.isArray(result)) {
    return result.flatMap((item, index) => flattenParts(item, `${prefix}-${index + 1}`));
  }
  return [{ id: prefix, name: prefix, geometry: result }];
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
