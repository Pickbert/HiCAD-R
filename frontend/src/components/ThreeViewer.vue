<script setup lang="ts">
import * as THREE from 'three';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { CameraPreset } from '../stores/workspace.js';
import { useWorkspaceStore } from '../stores/workspace.js';
import {
  buildGeometryFromWorkerMesh,
  computeMeshStats,
  mergeWorkerMeshesByMaterial,
  type WorkerMesh
} from '../utils/mesh.js';
import { createRenderTimeoutController } from '../workers/cad.worker-utils.js';

const store = useWorkspaceStore();
const canvasHost = ref<HTMLDivElement | null>(null);
const workerState = ref('Worker idle');
let renderer: THREE.WebGLRenderer | undefined;
let scene: THREE.Scene | undefined;
let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera | undefined;
let renderObjects: THREE.Object3D[] = [];
let frame = 0;
let worker: Worker | undefined;
let requestId = 0;
let renderTimeout: ReturnType<typeof createRenderTimeoutController> | undefined;
let grid: THREE.GridHelper | undefined;
let axes: THREE.AxesHelper | undefined;
let shadowPlane: THREE.Mesh | undefined;
let resizeObserver: ResizeObserver | undefined;

const cameraState = {
  target: new THREE.Vector3(0, 0, 0),
  distance: 280,
  yaw: Math.PI / 4,
  pitch: 0.62,
  dragging: false,
  panning: false,
  lastX: 0,
  lastY: 0
};

const dimensionsLabel = computed(() => {
  const box = store.renderStats?.boundingBox;
  if (box) return `W ${box.width} mm · D ${box.depth} mm · H ${box.height} mm`;
  const { width, depth, height } = store.preview.dimensions;
  return `W ${width} mm · D ${depth} mm · H ${height} mm`;
});
const statsLabel = computed(() => {
  const stats = store.renderStats;
  if (!stats) return '0 tris · 0 verts · 0ms';
  return `${stats.triangleCount} tris · ${stats.vertexCount} verts · ${stats.drawCallCount} draw · ${stats.elapsedMs ?? 0}ms`;
});
const visibleParameters = computed(() => store.parameters.slice(0, 6));
const partTree = computed(() => store.cadParts.slice(0, 12));

onMounted(() => {
  if (!canvasHost.value) return;
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#081018');
  camera = createCamera();
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  canvasHost.value.appendChild(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
  renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);
  renderer.domElement.addEventListener('pointerdown', handlePointerDown);
  renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });
  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerUp);
  resizeObserver = new ResizeObserver(resizeRenderer);
  resizeObserver.observe(canvasHost.value);
  setupSceneLighting();
  createWorker();
  rebuildMesh();
  syncViewOptions();
  animate();
});

watch(
  () => [store.code, store.viewMode, store.material, JSON.stringify(store.partMaterials)],
  () => rebuildMesh(),
  { deep: true }
);

watch(
  () => [store.viewMode, store.annotationSettings.grid, store.annotationSettings.axes, store.cameraPreset],
  () => syncViewOptions(),
  { deep: true }
);

onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  renderTimeout?.clear();
  worker?.terminate();
  resizeObserver?.disconnect();
  window.removeEventListener('pointermove', handlePointerMove);
  window.removeEventListener('pointerup', handlePointerUp);
  renderer?.domElement.removeEventListener('webglcontextlost', handleContextLost);
  renderer?.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
  renderer?.domElement.removeEventListener('pointerdown', handlePointerDown);
  renderer?.domElement.removeEventListener('wheel', handleWheel);
  renderer?.dispose();
});

function animate() {
  frame = requestAnimationFrame(animate);
  renderer?.render(scene!, camera!);
}

function rebuildMesh(force = false) {
  if (!scene) return;
  if (store.autoRenderPaused && !force) {
    workerState.value = 'AUTO PAUSED: 模型过大，已暂停自动渲染';
    return;
  }
  workerState.value = 'Worker rendering...';
  renderTimeout?.clear();
  worker?.postMessage({
    requestId: ++requestId,
    code: store.code,
    maxCodeBytes: Number(import.meta.env.VITE_CAD_MAX_CODE_BYTES ?? 200000),
    maxTriangles: Number(import.meta.env.VITE_CAD_MAX_TRIANGLES ?? 120000)
  });
  renderTimeout = createRenderTimeoutController(Number(import.meta.env.VITE_CAD_WORKER_TIMEOUT_MS ?? 5000), () => {
    workerState.value = 'TIMEOUT: 模型执行超时，已重建 Worker';
    worker?.terminate();
    createWorker();
  });
  renderTimeout.start();
}

function createWorker() {
  worker = new Worker(new URL('../workers/cad.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event) => {
    if (event.data?.requestId !== requestId) return;
    renderTimeout?.clear();
    if (event.data.ok) {
      const merged = mergeWorkerMeshesByMaterial(event.data.meshes);
      const stats = { ...computeMeshStats(merged), elapsedMs: event.data.elapsedMs };
      renderMeshes(merged);
      store.setRenderResult({ meshes: merged, parts: event.data.parts ?? [], stats });
      workerState.value = `Worker ${event.data.elapsedMs}ms · ${merged.length} draw call`;
    } else {
      clearMeshes();
      const message = `${event.data.error.code}: ${event.data.error.message}`;
      store.setRenderError(message, { pauseAutoRender: event.data.error.code === 'MODEL_TOO_COMPLEX' });
      workerState.value = message;
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
      opacity: store.viewMode === 'xray' ? 0.32 : materialName === 'glass' ? 0.55 : 1,
      wireframe: store.viewMode === 'wireframe' || store.viewMode === 'plan'
    });
    const item = new THREE.Mesh(geometry, material);
    item.castShadow = true;
    item.receiveShadow = true;
    scene.add(item);
    renderObjects.push(item);
    if (store.viewMode === 'xray') {
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: 0xb9d8ff, transparent: true, opacity: 0.85 })
      );
      scene.add(edges);
      renderObjects.push(edges);
    }
  }
  syncViewOptions();
}

function clearMeshes() {
  if (!scene) return;
  for (const item of renderObjects) {
    scene.remove(item);
    disposeObject(item);
  }
  renderObjects = [];
}

function setupSceneLighting() {
  if (!scene) return;
  scene.add(new THREE.HemisphereLight(0xb8d8ff, 0x101820, 1.25));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.25);
  keyLight.position.set(160, -120, 220);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0x7fb7ff, 0.85);
  fillLight.position.set(-180, 140, 120);
  scene.add(fillLight);
  shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(620, 620),
    new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.18 })
  );
  shadowPlane.position.z = -0.5;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);
  grid = new THREE.GridHelper(420, 28, 0x2f5f78, 0x183142);
  grid.rotation.x = Math.PI / 2;
  scene.add(grid);
  axes = new THREE.AxesHelper(130);
  scene.add(axes);
}

function createCamera() {
  const host = canvasHost.value;
  const aspect = host ? host.clientWidth / Math.max(host.clientHeight, 1) : 1;
  if (store.viewMode === 'plan') {
    const size = 320;
    return new THREE.OrthographicCamera((-size * aspect) / 2, (size * aspect) / 2, size / 2, -size / 2, 0.1, 5000);
  }
  return new THREE.PerspectiveCamera(45, aspect, 0.1, 5000);
}

function ensureCameraForMode() {
  if (!camera) {
    camera = createCamera();
    return;
  }
  const wantsPlan = store.viewMode === 'plan';
  if (
    (wantsPlan && camera instanceof THREE.OrthographicCamera) ||
    (!wantsPlan && camera instanceof THREE.PerspectiveCamera)
  )
    return;
  camera = createCamera();
}

function syncViewOptions() {
  ensureCameraForMode();
  resizeCamera();
  applyCameraPreset(store.viewMode === 'plan' ? 'top' : store.cameraPreset);
  if (grid) grid.visible = store.annotationSettings.grid;
  if (axes) axes.visible = store.annotationSettings.axes;
  if (shadowPlane) shadowPlane.visible = store.viewMode !== 'wireframe' && store.viewMode !== 'plan';
}

function applyCameraPreset(preset: CameraPreset) {
  if (!camera) return;
  const distance = cameraState.distance;
  const angles: Record<CameraPreset, { yaw: number; pitch: number }> = {
    front: { yaw: Math.PI, pitch: 0 },
    side: { yaw: Math.PI / 2, pitch: 0 },
    top: { yaw: 0, pitch: Math.PI / 2 },
    iso: { yaw: Math.PI * 0.75, pitch: 0.62 }
  };
  cameraState.yaw = angles[preset].yaw;
  cameraState.pitch = angles[preset].pitch;
  const presets: Record<CameraPreset, THREE.Vector3> = {
    front: new THREE.Vector3(0, -distance, 0),
    side: new THREE.Vector3(distance, 0, 0),
    top: new THREE.Vector3(0, 0, distance),
    iso: new THREE.Vector3(distance * 0.62, -distance * 0.62, distance * 0.56)
  };
  camera.position.copy(presets[preset]).add(cameraState.target);
  camera.up.set(0, preset === 'top' ? 1 : 0, preset === 'top' ? 0 : 1);
  camera.lookAt(cameraState.target);
  camera.updateProjectionMatrix();
}

function setPreset(preset: CameraPreset) {
  store.setCameraPreset(preset);
  if (preset !== 'top' && store.viewMode === 'plan') store.setViewMode('solid');
  syncViewOptions();
}

function resetCamera() {
  cameraState.target.set(0, 0, 0);
  cameraState.distance = 280;
  store.setCameraPreset('iso');
  if (store.viewMode === 'plan') store.setViewMode('solid');
  syncViewOptions();
}

function handlePointerDown(event: PointerEvent) {
  canvasHost.value?.focus();
  cameraState.dragging = true;
  cameraState.panning = event.shiftKey || event.button === 1;
  cameraState.lastX = event.clientX;
  cameraState.lastY = event.clientY;
}

function handlePointerMove(event: PointerEvent) {
  if (!cameraState.dragging || !camera || store.viewMode === 'plan') return;
  const dx = event.clientX - cameraState.lastX;
  const dy = event.clientY - cameraState.lastY;
  cameraState.lastX = event.clientX;
  cameraState.lastY = event.clientY;
  if (cameraState.panning) {
    const scale = cameraState.distance / 600;
    cameraState.target.x -= dx * scale;
    cameraState.target.y += dy * scale;
  } else {
    cameraState.yaw -= dx * 0.008;
    cameraState.pitch = Math.max(-1.2, Math.min(1.2, cameraState.pitch + dy * 0.008));
    updateCameraFromOrbit();
  }
  camera.lookAt(cameraState.target);
}

function handlePointerUp() {
  cameraState.dragging = false;
}

function handleWheel(event: WheelEvent) {
  event.preventDefault();
  cameraState.distance = Math.max(40, Math.min(1200, cameraState.distance * (event.deltaY > 0 ? 1.08 : 0.92)));
  if (camera) {
    const direction = camera.position.clone().sub(cameraState.target).normalize();
    camera.position.copy(cameraState.target).add(direction.multiplyScalar(cameraState.distance));
    camera.lookAt(cameraState.target);
  }
}

function handleViewerKeydown(event: KeyboardEvent) {
  const key = event.key.toLowerCase();
  const handledKeys = ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', '+', '=', '-', '_', '0', '1', '2', '3', '4'];
  if (!handledKeys.includes(key)) return;
  event.preventDefault();
  if (key === '0') return resetCamera();
  if (key === '1') return setPreset('front');
  if (key === '2') return setPreset('side');
  if (key === '3') return setPreset('top');
  if (key === '4') return setPreset('iso');
  if (key === '+' || key === '=') cameraState.distance = Math.max(40, cameraState.distance * 0.9);
  if (key === '-' || key === '_') cameraState.distance = Math.min(1200, cameraState.distance * 1.1);
  if (key === 'arrowleft') cameraState.yaw += 0.08;
  if (key === 'arrowright') cameraState.yaw -= 0.08;
  if (key === 'arrowup') cameraState.pitch = Math.min(1.2, cameraState.pitch + 0.08);
  if (key === 'arrowdown') cameraState.pitch = Math.max(-1.2, cameraState.pitch - 0.08);
  updateCameraFromOrbit();
}

function updateCameraFromOrbit() {
  if (!camera) return;
  const x = cameraState.distance * Math.cos(cameraState.pitch) * Math.sin(cameraState.yaw);
  const y = cameraState.distance * Math.cos(cameraState.pitch) * Math.cos(cameraState.yaw);
  const z = cameraState.distance * Math.sin(cameraState.pitch);
  camera.position.set(x, y, z).add(cameraState.target);
  camera.lookAt(cameraState.target);
}

function handleContextLost(event: Event) {
  event.preventDefault();
  workerState.value = 'WEBGL_CONTEXT_LOST: WebGL 上下文丢失，等待恢复';
}

function handleContextRestored() {
  workerState.value = 'WEBGL_CONTEXT_RESTORED: 正在恢复模型';
  rebuildMesh(true);
}

function resizeRenderer() {
  if (!renderer || !canvasHost.value) return;
  renderer.setSize(canvasHost.value.clientWidth, canvasHost.value.clientHeight);
  resizeCamera();
}

function resizeCamera() {
  if (!camera || !canvasHost.value) return;
  const aspect = canvasHost.value.clientWidth / Math.max(canvasHost.value.clientHeight, 1);
  if (camera instanceof THREE.PerspectiveCamera) {
    camera.aspect = aspect;
  } else {
    const size = 320;
    camera.left = (-size * aspect) / 2;
    camera.right = (size * aspect) / 2;
    camera.top = size / 2;
    camera.bottom = -size / 2;
  }
  camera.updateProjectionMatrix();
}

function disposeObject(item: THREE.Object3D) {
  const mesh = item as THREE.Mesh | THREE.LineSegments;
  const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
  const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
  geometry?.dispose();
  if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
  else material?.dispose();
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
      steel: 0x8d99a6,
      colorized: 0x73d6ff
    }[material] ?? 0x4ea1ff
  );
}
</script>

<template>
  <section class="viewer-panel">
    <div class="viewer-toolbar">
      <div class="mode-tabs" role="tablist" aria-label="视图模式">
        <button
          :class="{ active: store.viewMode === 'solid' }"
          aria-label="切换到实体视图"
          @click="store.setViewMode('solid')"
        >
          实体
        </button>
        <button
          :class="{ active: store.viewMode === 'wireframe' }"
          aria-label="切换到线框视图"
          @click="store.setViewMode('wireframe')"
        >
          线框
        </button>
        <button
          :class="{ active: store.viewMode === 'xray' }"
          aria-label="切换到 X-Ray 视图"
          @click="store.setViewMode('xray')"
        >
          X-Ray
        </button>
        <button
          :class="{ active: store.viewMode === 'plan' }"
          aria-label="切换到平面 CAD 视图"
          @click="store.setViewMode('plan')"
        >
          平面 CAD
        </button>
      </div>
      <span>{{ dimensionsLabel }} · {{ statsLabel }}</span>
    </div>
    <div class="camera-toolbar" aria-label="相机控制">
      <button :class="{ active: store.cameraPreset === 'front' }" aria-label="切换到正视图" @click="setPreset('front')">
        正视
      </button>
      <button :class="{ active: store.cameraPreset === 'side' }" aria-label="切换到侧视图" @click="setPreset('side')">
        侧视
      </button>
      <button :class="{ active: store.cameraPreset === 'top' }" aria-label="切换到顶视图" @click="setPreset('top')">
        顶视
      </button>
      <button :class="{ active: store.cameraPreset === 'iso' }" aria-label="切换到等轴测视图" @click="setPreset('iso')">
        等轴测
      </button>
      <button aria-label="重置相机视角" @click="resetCamera">重置</button>
    </div>
    <div
      ref="canvasHost"
      class="canvas-host"
      role="application"
      tabindex="0"
      aria-label="三维模型预览，方向键旋转，按加减号缩放，按 0 重置视角，按 1 到 4 切换预设视角"
      aria-describedby="viewer-status-text"
      @keydown="handleViewerKeydown"
    ></div>
    <div v-if="store.annotationSettings.dimensions" class="dimension-label">{{ dimensionsLabel }}</div>
    <div v-if="store.viewMode === 'plan' && store.annotationSettings.dimensions" class="plan-dimensions">
      <span class="dim-line horizontal"></span>
      <span class="dim-line vertical"></span>
      <span>水平 {{ store.renderStats?.boundingBox.width ?? store.preview.dimensions.width }} mm</span>
      <span>垂直 {{ store.renderStats?.boundingBox.depth ?? store.preview.dimensions.depth }} mm</span>
    </div>
    <div v-if="store.annotationSettings.parameterLabels" class="parameter-labels">
      <span v-for="parameter in visibleParameters" :key="parameter.name"
        >{{ parameter.label }} {{ parameter.value }}{{ parameter.unit }}</span
      >
    </div>
    <div v-if="partTree.length" class="part-tree">
      <strong>部件树</strong>
      <span v-for="part in partTree" :key="part.id"
        >{{ part.name }} · {{ part.material }} · {{ part.triangleCount }} tris</span
      >
    </div>
    <div class="viewer-status">
      <span id="viewer-status-text">{{ store.renderError || workerState }}</span>
      <button
        v-if="store.autoRenderPaused"
        aria-label="继续渲染一次大模型"
        @click="
          store.resumeAutoRender();
          rebuildMesh(true);
        "
      >
        继续渲染一次
      </button>
    </div>
  </section>
</template>
