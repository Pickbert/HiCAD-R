import { defineStore } from 'pinia';
import type { CadModel, CadParameter, MaterialPreset, User } from '@hicad/shared';
import { applyCadParameters, parseCadParameters } from '@hicad/shared';
import type { AuthResponse, AuthState } from '../api.js';
import { buildPreviewSummary, type PreviewSummary } from '../utils/cad.js';
import { clearStoredAuth, loadStoredAuth, saveStoredAuth } from '../utils/auth.js';
import type { CodeDiffSummary, UiMessage } from '../utils/ai.js';
import { buildCodeDiffSummary } from '../utils/ai.js';
import type { CadPartNode } from '../utils/cadRuntime.js';
import type { MeshStats, WorkerMesh } from '../utils/mesh.js';
import { captureParameterDefaults, normalizeParameterValue, resetParameterDefaults } from '../utils/parameters.js';

const defaultCode = `// @material: cad-blue
const boxWidth = 80 // 模型宽度 unit:mm min:10 max:500 step:5
const boxDepth = 50 // 模型深度 unit:mm min:10 max:500 step:5
const boxHeight = 30 // 模型高度 unit:mm min:10 max:500 step:5
const wallThickness = 2 // 壁厚 unit:mm min:1 max:10 step:0.5

function main() {
  const outer = roundedCuboid({ size: [boxWidth, boxDepth, boxHeight], roundRadius: 4, segments: 16 })
  const inner = translate([0, 0, wallThickness], roundedCuboid({
    size: [boxWidth - wallThickness * 2, boxDepth - wallThickness * 2, boxHeight],
    roundRadius: 2,
    segments: 16
  }))
  return colorize([0.15, 0.45, 0.9], subtract(outer, inner))
}
module.exports = { main }
`;

export type RouteView = 'workspace' | 'market' | 'models' | 'admin' | 'share';
export type CameraPreset = 'front' | 'side' | 'top' | 'iso';

export const materialPresets: Array<{ id: MaterialPreset; label: string; color: string }> = [
  { id: 'cad-blue', label: 'CAD Blue', color: '#4ea1ff' },
  { id: 'silver', label: 'Silver', color: '#d7dde8' },
  { id: 'gold', label: 'Gold', color: '#e8b949' },
  { id: 'copper', label: 'Copper', color: '#c8793a' },
  { id: 'ceramic', label: 'Ceramic', color: '#f1f3f4' },
  { id: 'glass', label: 'Glass', color: '#9adfff' },
  { id: 'neon', label: 'Neon', color: '#22ffaa' },
  { id: 'matte-black', label: 'Matte Black', color: '#1b1f28' },
  { id: 'white', label: 'White', color: '#ffffff' },
  { id: 'steel', label: 'Steel', color: '#8d99a6' }
];

export const useWorkspaceStore = defineStore('workspace', {
  state: () => ({
    code: defaultCode,
    title: '未命名模型',
    prompt: '',
    provider: 'deepseek',
    viewMode: 'solid' as 'solid' | 'wireframe' | 'xray' | 'plan',
    material: 'cad-blue' as MaterialPreset,
    messages: [] as UiMessage[],
    meshes: [] as WorkerMesh[],
    cadParts: [] as CadPartNode[],
    renderStats: undefined as (MeshStats & { elapsedMs?: number }) | undefined,
    autoRenderPaused: false,
    renderError: '',
    cameraPreset: 'iso' as CameraPreset,
    user: undefined as User | undefined,
    accessToken: '',
    refreshToken: '',
    currentModelId: '',
    authReady: false,
    routeView: 'workspace' as RouteView,
    shareToken: '',
    status: '',
    error: '',
    toasts: [] as Array<{ id: number; type: 'info' | 'success' | 'error'; text: string }>,
    myModels: [] as CadModel[],
    isGenerating: false,
    aiMode: 'generate' as 'generate' | 'modify',
    aiStatus: 'idle' as 'idle' | 'start' | 'spec' | 'retry' | 'code' | 'done' | 'error' | 'fallback',
    aiEvents: [] as string[],
    aiHistory: [] as Array<{ id: string; prompt: string; code: string; provider: string; createdAt: string }>,
    pendingAiCode: '',
    pendingAiSummary: undefined as CodeDiffSummary | undefined,
    annotationSettings: {
      dimensions: true,
      parameterLabels: true,
      axes: true,
      grid: true
    },
    partMaterials: {} as Record<string, MaterialPreset>,
    parameterDefaults: captureParameterDefaults(defaultCode),
    saving: false,
    publishing: false,
    sharing: false,
    importing: false
  }),
  getters: {
    parameters(state): CadParameter[] {
      return parseCadParameters(state.code);
    },
    preview(state): PreviewSummary {
      return buildPreviewSummary(state.code);
    },
    isLoggedIn(state): boolean {
      return Boolean(state.accessToken && state.user);
    },
    isAdmin(state): boolean {
      return state.user?.role === 'admin';
    }
  },
  actions: {
    initAuth() {
      const stored = loadStoredAuth();
      if (stored) {
        this.accessToken = stored.accessToken;
        this.refreshToken = stored.refreshToken;
        this.user = stored.user;
      }
      this.authReady = true;
    },
    setAuth(auth: AuthResponse) {
      this.accessToken = auth.accessToken;
      this.refreshToken = auth.refreshToken;
      this.user = auth.user;
      saveStoredAuth({ accessToken: auth.accessToken, refreshToken: auth.refreshToken, user: auth.user });
    },
    logout() {
      this.accessToken = '';
      this.refreshToken = '';
      this.user = undefined;
      this.currentModelId = '';
      clearStoredAuth();
      this.toast('info', '已退出登录');
    },
    apiAuth(): AuthState {
      return {
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        onRefresh: (auth) => this.setAuth(auth),
        onAuthExpired: () => this.logout()
      };
    },
    navigate(view: RouteView, shareToken = '') {
      this.routeView = view;
      this.shareToken = shareToken;
      const hash = view === 'share' && shareToken ? `#/share/${shareToken}` : view === 'workspace' ? '#/' : `#/${view}`;
      if (typeof window !== 'undefined' && window.location.hash !== hash) window.location.hash = hash;
    },
    setCode(code: string, options: { captureDefaults?: boolean } = {}) {
      this.code = code;
      this.material = buildPreviewSummary(code).material;
      if (options.captureDefaults) this.parameterDefaults = captureParameterDefaults(code);
    },
    updateParameter(parameter: CadParameter, value: number) {
      const normalized = normalizeParameterValue(parameter, value);
      this.setCode(applyCadParameters(this.code, [{ ...parameter, value: normalized }]));
    },
    resetParameters() {
      this.setCode(resetParameterDefaults(this.code, this.parameterDefaults));
    },
    applyTemplate(template: { title: string; code: string; material?: MaterialPreset }) {
      this.title = template.title;
      this.setCode(template.code, { captureDefaults: true });
      if (template.material) this.material = template.material;
    },
    applyModel(model: CadModel) {
      this.currentModelId = model.id;
      this.title = model.title;
      this.setCode(model.code, { captureDefaults: true });
      this.material = model.material;
      this.navigate('workspace');
    },
    setMeshes(meshes: WorkerMesh[]) {
      this.meshes = meshes;
    },
    setRenderResult(payload: {
      meshes: WorkerMesh[];
      parts: CadPartNode[];
      stats: MeshStats & { elapsedMs?: number };
    }) {
      this.meshes = payload.meshes;
      this.cadParts = payload.parts;
      this.renderStats = payload.stats;
      this.renderError = '';
      this.autoRenderPaused = false;
    },
    setRenderError(message: string, options: { pauseAutoRender?: boolean } = {}) {
      this.meshes = [];
      this.cadParts = [];
      this.renderError = message;
      this.autoRenderPaused = Boolean(options.pauseAutoRender);
    },
    resumeAutoRender() {
      this.autoRenderPaused = false;
      this.renderError = '';
    },
    setCameraPreset(preset: CameraPreset) {
      this.cameraPreset = preset;
      if (preset === 'top') this.viewMode = 'plan';
    },
    setPendingAiCode(code: string) {
      this.pendingAiCode = code;
      this.pendingAiSummary = buildCodeDiffSummary(this.code, code);
    },
    applyPendingAiCode() {
      if (!this.pendingAiCode) return;
      this.setCode(this.pendingAiCode, { captureDefaults: true });
      this.pendingAiCode = '';
      this.pendingAiSummary = undefined;
      this.toast('success', 'AI 代码已应用');
    },
    discardPendingAiCode() {
      this.pendingAiCode = '';
      this.pendingAiSummary = undefined;
    },
    toast(type: 'info' | 'success' | 'error', text: string) {
      this.toasts.push({ id: Date.now() + Math.random(), type, text });
      this.status = text;
      if (type === 'error') this.error = text;
      window.setTimeout(() => {
        this.toasts = this.toasts.slice(1);
      }, 3800);
    },
    clearError() {
      this.error = '';
    },
    setViewMode(mode: 'solid' | 'wireframe' | 'xray' | 'plan') {
      this.viewMode = mode;
    },
    setMaterial(material: MaterialPreset) {
      this.material = material;
      if (/@material:\s*[A-Za-z0-9_-]+/.test(this.code)) {
        this.setCode(this.code.replace(/@material:\s*[A-Za-z0-9_-]+/, `@material: ${material}`));
      } else {
        this.setCode(`// @material: ${material}\n${this.code}`);
      }
    }
  }
});
