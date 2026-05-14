import { runCadRuntime, type CadPartNode } from '../utils/cadRuntime.js';
import type { MeshStats, WorkerMesh } from '../utils/mesh.js';
import { toStructuredWorkerError, type StructuredWorkerError } from './cad.worker-utils.js';

interface WorkerRequest {
  requestId: number;
  code: string;
  maxCodeBytes?: number;
  maxTriangles?: number;
}

interface WorkerSuccess {
  requestId: number;
  ok: true;
  elapsedMs: number;
  meshes: WorkerMesh[];
  parts: CadPartNode[];
  stats: MeshStats;
}

interface WorkerFailure {
  requestId: number;
  ok: false;
  error: StructuredWorkerError;
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const startedAt = performance.now();
  const { requestId, code, maxCodeBytes = 200000, maxTriangles = 120000 } = event.data;
  try {
    const result = runCadRuntime({ code, maxCodeBytes, maxTriangles });
    const response: WorkerSuccess = {
      requestId,
      ok: true,
      elapsedMs: Math.round(performance.now() - startedAt),
      meshes: result.meshes,
      parts: result.parts,
      stats: result.stats
    };
    (self as unknown as { postMessage(message: unknown, transfer: Transferable[]): void }).postMessage(
      response,
      result.transferables
    );
  } catch (error) {
    const response: WorkerFailure = {
      requestId,
      ok: false,
      error: toStructuredWorkerError(error)
    };
    self.postMessage(response);
  }
};
