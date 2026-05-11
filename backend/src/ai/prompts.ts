import type { AiMessage } from './adapters/types.js';
import type { DesignSpec } from './codegen.js';

const allowedKinds = new Set(['box', 'tank', 'arm', 'vehicle', 'room', 'generic']);

export function buildDesignMessages(prompt: string, kindHint: DesignSpec['kind'] = 'generic'): AiMessage[] {
  return [
    {
      role: 'system',
      content: `You convert CAD requests into strict JSON only. Return one strict JSON object with keys: kind,title,width,depth,height,material. No markdown. No comments. Allowed kind values: generic, box, tank, arm, vehicle, room. Units are millimeters. Prefer kind "${kindHint}" when appropriate.`
    },
    {
      role: 'user',
      content: prompt
    }
  ];
}

export function parseDesignSpecJson(content: string): DesignSpec {
  const parsed = JSON.parse(content) as Partial<DesignSpec>;
  if (!parsed.kind || !allowedKinds.has(parsed.kind)) {
    throw new Error('Invalid design spec: kind is required');
  }
  const width = finitePositive(parsed.width, 80);
  const depth = finitePositive(parsed.depth, 50);
  const height = finitePositive(parsed.height, 30);
  return {
    kind: parsed.kind,
    title: String(parsed.title ?? '未命名模型').slice(0, 80),
    width,
    depth,
    height,
    material: String(parsed.material ?? 'cad-blue')
  };
}

export function inferPromptKind(prompt: string): DesignSpec['kind'] {
  const normalized = prompt.toLowerCase();
  if (normalized.includes('坦克')) return 'tank';
  if (normalized.includes('机械臂')) return 'arm';
  if (normalized.includes('汽车') || normalized.includes('车')) return 'vehicle';
  if (normalized.includes('室内') || normalized.includes('房间') || normalized.includes('平面')) return 'room';
  if (normalized.includes('盒') || normalized.includes('箱')) return 'box';
  return 'generic';
}

function finitePositive(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}
