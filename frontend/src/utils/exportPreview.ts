import { computeMeshStats, type WorkerMesh } from './mesh.js';

export type ExportFormat = 'stl' | 'obj';

export interface ExportPreview {
  format: 'STL' | 'OBJ';
  unit: 'mm';
  triangleCount: number;
  vertexCount: number;
  meshCount: number;
  drawCallCount: number;
  volumeMm3: number;
  volumeLabel: string;
  volumeSource: 'mesh' | 'bounding-box' | 'empty';
  estimatedBytes: number;
  estimatedSizeLabel: string;
}

export function buildExportPreview(meshes: WorkerMesh[], format: ExportFormat): ExportPreview {
  const stats = computeMeshStats(meshes);
  const meshVolume = computeSignedMeshVolume(meshes);
  const boxVolume = stats.boundingBox.width * stats.boundingBox.depth * stats.boundingBox.height;
  const volumeSource = meshVolume > 0.0001 ? 'mesh' : boxVolume > 0.0001 ? 'bounding-box' : 'empty';
  const volumeMm3 = roundVolume(volumeSource === 'mesh' ? meshVolume : volumeSource === 'bounding-box' ? boxVolume : 0);
  const estimatedBytes = estimateExportBytes(format, stats.triangleCount, stats.vertexCount);

  return {
    format: format.toUpperCase() as 'STL' | 'OBJ',
    unit: 'mm',
    triangleCount: stats.triangleCount,
    vertexCount: stats.vertexCount,
    meshCount: stats.meshCount,
    drawCallCount: stats.drawCallCount,
    volumeMm3,
    volumeLabel: formatVolume(volumeMm3),
    volumeSource,
    estimatedBytes,
    estimatedSizeLabel: formatBytes(estimatedBytes)
  };
}

function computeSignedMeshVolume(meshes: WorkerMesh[]): number {
  let signedVolume = 0;
  for (const mesh of meshes) {
    for (let index = 0; index < mesh.indices.length; index += 3) {
      const a = mesh.indices[index] * 3;
      const b = mesh.indices[index + 1] * 3;
      const c = mesh.indices[index + 2] * 3;
      signedVolume += tetrahedronVolume(
        [mesh.positions[a], mesh.positions[a + 1], mesh.positions[a + 2]],
        [mesh.positions[b], mesh.positions[b + 1], mesh.positions[b + 2]],
        [mesh.positions[c], mesh.positions[c + 1], mesh.positions[c + 2]]
      );
    }
  }
  return Math.abs(signedVolume);
}

function tetrahedronVolume(
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number]
): number {
  return (
    (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6
  );
}

function estimateExportBytes(format: ExportFormat, triangleCount: number, vertexCount: number): number {
  if (format === 'stl') return Math.max(96, Math.round(140 + triangleCount * 170));
  return Math.max(64, Math.round(80 + vertexCount * 42 + triangleCount * 34));
}

function formatVolume(volumeMm3: number): string {
  if (volumeMm3 >= 1000) return `${(volumeMm3 / 1000).toFixed(2)} cm³`;
  return `${volumeMm3.toFixed(volumeMm3 >= 10 ? 1 : 2)} mm³`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function roundVolume(value: number): number {
  return Number(value.toFixed(4));
}
