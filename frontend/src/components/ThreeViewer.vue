<script setup lang="ts">
import * as THREE from 'three';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useWorkspaceStore } from '../stores/workspace.js';
import { buildGeometryFromWorkerMesh, type WorkerMesh } from '../utils/mesh.js';

const store = useWorkspaceStore();
const canvasHost = ref<HTMLDivElement | null>(null);
const workerState = ref('Worker idle');
let renderer: THREE.WebGLRenderer | undefined;
let scene: THREE.Scene | undefined;
let camera: THREE.PerspectiveCamera | undefined;
let meshes: THREE.Mesh[] = [];
let frame = 0;
let worker: Worker | undefined;
let requestId = 0;
let workerTimer = 0;

const dimensionsLabel = computed(() => {
  const { width, depth, height } = store.preview.dimensions;
  return `W ${width} mm · D ${depth} mm · H ${height} mm`;
});
const statsLabel = computed(() => {
  const triangles = store.meshes.reduce((total, mesh) => total + mesh.indices.length / 3, 0);
  const vertices = store.meshes.reduce((total, mesh) => total + mesh.positions.length / 3, 0);
  return `${triangles} tris · ${vertices} verts`;
});
const visibleParameters = computed(() => store.parameters.slice(0, 6));
let grid: THREE.GridHelper | undefined;
let axes: THREE.AxesHelper | undefined;

onMounted(() => {
  if (!canvasHost.value) return;
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#081018');
  camera = new THREE.PerspectiveCamera(45, canvasHost.value.clientWidth / canvasHost.value.clientHeight, 0.1, 5000);
  camera.position.set(160, 130, 180);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(canvasHost.value.clientWidth, canvasHost.value.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  canvasHost.value.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0x9fcaff, 0x101820, 1.5));
  grid = new THREE.GridHelper(420, 28, 0x21445a, 0x172937);
  scene.add(grid);
  axes = new THREE.AxesHelper(130);
  scene.add(axes);
  createWorker();
  rebuildMesh();
  syncViewOptions();
  animate();
});

watch(
  () => [store.code, store.viewMode, store.material],
  () => rebuildMesh(),
  { deep: true }
);

watch(
  () => [store.viewMode, store.annotationSettings.grid, store.annotationSettings.axes],
  () => syncViewOptions(),
  { deep: true }
);

onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  window.clearTimeout(workerTimer);
  worker?.terminate();
  renderer?.dispose();
});

function animate() {
  frame = requestAnimationFrame(animate);
  if (store.viewMode !== 'plan') {
    for (const item of meshes) item.rotation.z += 0.002;
  }
  renderer?.render(scene!, camera!);
}

function rebuildMesh() {
  if (!scene) return;
  workerState.value = 'Worker rendering...';
  window.clearTimeout(workerTimer);
  worker?.postMessage({
    requestId: ++requestId,
    code: store.code,
    maxCodeBytes: Number(import.meta.env.VITE_CAD_MAX_CODE_BYTES ?? 200000)
  });
  workerTimer = window.setTimeout(() => {
    workerState.value = 'TIMEOUT: 模型执行超时，已重建 Worker';
    worker?.terminate();
    createWorker();
  }, Number(import.meta.env.VITE_CAD_WORKER_TIMEOUT_MS ?? 5000));
}

function createWorker() {
  worker = new Worker(new URL('../workers/cad.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event) => {
    if (event.data?.requestId !== requestId) return;
    window.clearTimeout(workerTimer);
    if (event.data.ok) {
      renderMeshes(event.data.meshes);
      store.setMeshes(event.data.meshes);
      workerState.value = `Worker ${event.data.elapsedMs}ms · ${event.data.meshes.length} mesh`;
    } else {
      clearMeshes();
      store.setMeshes([]);
      workerState.value = `${event.data.error.code}: ${event.data.error.message}`;
    }
  };
}

function renderMeshes(workerMeshes: WorkerMesh[]) {
  if (!scene) return;
  clearMeshes();
  for (const workerMesh of workerMeshes) {
    const geometry = buildGeometryFromWorkerMesh(workerMesh);
    const materialName = store.partMaterials[workerMesh.material] ?? workerMesh.material;
    const overrideColor = materialName === workerMesh.material ? undefined : materialColor(materialName);
    const material = new THREE.MeshStandardMaterial({
      color: overrideColor ?? new THREE.Color(workerMesh.color[0], workerMesh.color[1], workerMesh.color[2]),
      metalness: materialName === 'gold' || materialName === 'silver' || materialName === 'steel' ? 0.75 : 0.2,
      roughness: materialName === 'glass' ? 0.05 : 0.35,
      transparent: store.viewMode === 'xray' || materialName === 'glass',
      opacity: store.viewMode === 'xray' ? 0.35 : materialName === 'glass' ? 0.55 : 1,
      wireframe: store.viewMode === 'wireframe' || store.viewMode === 'plan'
    });
    const item = new THREE.Mesh(geometry, material);
    scene.add(item);
    meshes.push(item);
  }
  camera?.lookAt(0, 0, 0);
  syncViewOptions();
}

function clearMeshes() {
  if (!scene) return;
  for (const item of meshes) {
    scene.remove(item);
    item.geometry.dispose();
    Array.isArray(item.material) ? item.material.forEach((material) => material.dispose()) : item.material.dispose();
  }
  meshes = [];
}

function materialColor(material: string): number {
  return (
    {
      'cad-blue': 0x4ea1ff,
      silver: 0xd7dde8,
      gold: 0xe8b949,
      copper: 0xc8793a,
      ceramic: 0xf1f3f4,
      glass: 0x9adfff,
      neon: 0x22ffaa,
      'matte-black': 0x1b1f28,
      white: 0xffffff,
      steel: 0x8d99a6
    }[material] ?? 0x4ea1ff
  );
}

function syncViewOptions() {
  if (!camera) return;
  if (store.viewMode === 'plan') {
    camera.position.set(0, 0, 360);
    camera.up.set(0, 1, 0);
  } else {
    camera.position.set(160, 130, 180);
    camera.up.set(0, 1, 0);
  }
  camera.lookAt(0, 0, 0);
  if (grid) grid.visible = store.annotationSettings.grid;
  if (axes) axes.visible = store.annotationSettings.axes;
}
</script>

<template>
  <section class="viewer-panel">
    <div class="viewer-toolbar">
      <div class="mode-tabs">
        <button :class="{ active: store.viewMode === 'solid' }" @click="store.viewMode = 'solid'">实体</button>
        <button :class="{ active: store.viewMode === 'wireframe' }" @click="store.viewMode = 'wireframe'">线框</button>
        <button :class="{ active: store.viewMode === 'xray' }" @click="store.viewMode = 'xray'">X-Ray</button>
        <button :class="{ active: store.viewMode === 'plan' }" @click="store.viewMode = 'plan'">平面 CAD</button>
      </div>
      <span>{{ dimensionsLabel }} · {{ statsLabel }}</span>
    </div>
    <div ref="canvasHost" class="canvas-host"></div>
    <div v-if="store.annotationSettings.dimensions" class="dimension-label">{{ dimensionsLabel }}</div>
    <div v-if="store.annotationSettings.parameterLabels" class="parameter-labels">
      <span v-for="parameter in visibleParameters" :key="parameter.name">{{ parameter.label }} {{ parameter.value }}{{ parameter.unit }}</span>
    </div>
    <div class="viewer-status">{{ workerState }}</div>
  </section>
</template>
