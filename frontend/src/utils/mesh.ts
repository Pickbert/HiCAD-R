import * as THREE from 'three';

export interface WorkerMesh {
  material: string;
  color: [number, number, number];
  partIds?: string[];
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

export interface MeshBoundingBox {
  min: [number, number, number];
  max: [number, number, number];
  width: number;
  depth: number;
  height: number;
}

export interface MeshStats {
  triangleCount: number;
  vertexCount: number;
  meshCount: number;
  drawCallCount: number;
  boundingBox: MeshBoundingBox;
}

export function buildGeometryFromWorkerMesh(mesh: WorkerMesh): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function mergeWorkerMeshesByMaterial(meshes: WorkerMesh[]): WorkerMesh[] {
  const groups = new Map<string, WorkerMesh[]>();
  for (const mesh of meshes) {
    const key = `${mesh.material}:${mesh.color.join(',')}`;
    groups.set(key, [...(groups.get(key) ?? []), mesh]);
  }
  return [...groups.values()].map(mergeMeshGroup);
}

export function computeMeshStats(meshes: WorkerMesh[]): MeshStats {
  let triangleCount = 0;
  let vertexCount = 0;
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const mesh of meshes) {
    triangleCount += mesh.indices.length / 3;
    vertexCount += mesh.positions.length / 3;
    for (let index = 0; index < mesh.positions.length; index += 3) {
      min[0] = Math.min(min[0], mesh.positions[index]);
      min[1] = Math.min(min[1], mesh.positions[index + 1]);
      min[2] = Math.min(min[2], mesh.positions[index + 2]);
      max[0] = Math.max(max[0], mesh.positions[index]);
      max[1] = Math.max(max[1], mesh.positions[index + 1]);
      max[2] = Math.max(max[2], mesh.positions[index + 2]);
    }
  }
  const empty = vertexCount === 0;
  const safeMin: [number, number, number] = empty ? [0, 0, 0] : min;
  const safeMax: [number, number, number] = empty ? [0, 0, 0] : max;
  return {
    triangleCount,
    vertexCount,
    meshCount: meshes.length,
    drawCallCount: meshes.length,
    boundingBox: {
      min: safeMin,
      max: safeMax,
      width: Number((safeMax[0] - safeMin[0]).toFixed(4)),
      depth: Number((safeMax[1] - safeMin[1]).toFixed(4)),
      height: Number((safeMax[2] - safeMin[2]).toFixed(4))
    }
  };
}

export function meshToStl(meshes: WorkerMesh[], name = 'hicad-model'): string {
  const lines = [`solid ${name}`];
  for (const mesh of meshes) {
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const ia = mesh.indices[i] * 3;
      const ib = mesh.indices[i + 1] * 3;
      const ic = mesh.indices[i + 2] * 3;
      const n = normalAt(mesh, ia);
      lines.push(`  facet normal ${n[0]} ${n[1]} ${n[2]}`);
      lines.push('    outer loop');
      lines.push(`      vertex ${mesh.positions[ia]} ${mesh.positions[ia + 1]} ${mesh.positions[ia + 2]}`);
      lines.push(`      vertex ${mesh.positions[ib]} ${mesh.positions[ib + 1]} ${mesh.positions[ib + 2]}`);
      lines.push(`      vertex ${mesh.positions[ic]} ${mesh.positions[ic + 1]} ${mesh.positions[ic + 2]}`);
      lines.push('    endloop');
      lines.push('  endfacet');
    }
  }
  lines.push(`endsolid ${name}`);
  return `${lines.join('\n')}\n`;
}

export function meshToObj(meshes: WorkerMesh[], name = 'hicad-model'): string {
  const lines = [`o ${name}`];
  let vertexOffset = 1;
  for (const mesh of meshes) {
    lines.push(`g ${mesh.material}`);
    for (let i = 0; i < mesh.positions.length; i += 3) {
      lines.push(`v ${mesh.positions[i]} ${mesh.positions[i + 1]} ${mesh.positions[i + 2]}`);
    }
    for (let i = 0; i < mesh.normals.length; i += 3) {
      lines.push(`vn ${mesh.normals[i]} ${mesh.normals[i + 1]} ${mesh.normals[i + 2]}`);
    }
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const a = mesh.indices[i] + vertexOffset;
      const b = mesh.indices[i + 1] + vertexOffset;
      const c = mesh.indices[i + 2] + vertexOffset;
      lines.push(`f ${a}//${a} ${b}//${b} ${c}//${c}`);
    }
    vertexOffset += mesh.positions.length / 3;
  }
  return `${lines.join('\n')}\n`;
}

function normalAt(mesh: WorkerMesh, positionIndex: number): [number, number, number] {
  return [mesh.normals[positionIndex] ?? 0, mesh.normals[positionIndex + 1] ?? 0, mesh.normals[positionIndex + 2] ?? 1];
}

function mergeMeshGroup(group: WorkerMesh[]): WorkerMesh {
  if (group.length === 1) return group[0];
  const positionLength = group.reduce((total, mesh) => total + mesh.positions.length, 0);
  const normalLength = group.reduce((total, mesh) => total + mesh.normals.length, 0);
  const indexLength = group.reduce((total, mesh) => total + mesh.indices.length, 0);
  const positions = new Float32Array(positionLength);
  const normals = new Float32Array(normalLength);
  const indices = new Uint32Array(indexLength);
  const partIds = [...new Set(group.flatMap((mesh) => mesh.partIds ?? []))];
  let positionOffset = 0;
  let normalOffset = 0;
  let indexOffset = 0;
  let vertexOffset = 0;
  for (const mesh of group) {
    positions.set(mesh.positions, positionOffset);
    normals.set(mesh.normals, normalOffset);
    for (let index = 0; index < mesh.indices.length; index += 1) {
      indices[indexOffset + index] = mesh.indices[index] + vertexOffset;
    }
    positionOffset += mesh.positions.length;
    normalOffset += mesh.normals.length;
    indexOffset += mesh.indices.length;
    vertexOffset += mesh.positions.length / 3;
  }
  return {
    material: group[0].material,
    color: group[0].color,
    partIds,
    positions,
    normals,
    indices
  };
}
