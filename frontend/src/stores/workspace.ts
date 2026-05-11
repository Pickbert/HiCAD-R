import { defineStore } from 'pinia';
import type { CadParameter, MaterialPreset, User } from '@hicad/shared';
import { applyCadParameters, parseCadParameters } from '@hicad/shared';
import { buildPreviewSummary, type PreviewSummary } from '../utils/cad.js';
import type { WorkerMesh } from '../utils/mesh.js';

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

export const useWorkspaceStore = defineStore('workspace', {
  state: () => ({
    code: defaultCode,
    title: '未命名模型',
    prompt: '',
    provider: 'deepseek',
    viewMode: 'solid' as 'solid' | 'wireframe' | 'xray' | 'plan',
    material: 'cad-blue' as MaterialPreset,
    messages: [] as Array<{ role: 'user' | 'assistant' | 'system'; text: string }>,
    meshes: [] as WorkerMesh[],
    user: undefined as User | undefined,
    accessToken: '',
    refreshToken: '',
    currentModelId: '',
    isGenerating: false
  }),
  getters: {
    parameters(state): CadParameter[] {
      return parseCadParameters(state.code);
    },
    preview(state): PreviewSummary {
      return buildPreviewSummary(state.code);
    }
  },
  actions: {
    setCode(code: string) {
      this.code = code;
      this.material = buildPreviewSummary(code).material;
    },
    updateParameter(parameter: CadParameter, value: number) {
      this.setCode(applyCadParameters(this.code, [{ ...parameter, value }]));
    },
    applyTemplate(template: { title: string; code: string; material?: MaterialPreset }) {
      this.title = template.title;
      this.setCode(template.code);
      if (template.material) this.material = template.material;
    },
    setMeshes(meshes: WorkerMesh[]) {
      this.meshes = meshes;
    }
  }
});
