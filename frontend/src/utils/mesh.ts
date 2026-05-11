import * as THREE from 'three';

export interface WorkerMesh {
  material: string;
  color: [number, number, number];
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
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
