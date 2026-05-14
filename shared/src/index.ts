export type UserRole = 'user' | 'admin';
export type UserTier = 'free' | 'pro' | 'team';
export type AiProvider = 'deepseek' | 'openai' | 'qwen';
export type AiStreamEventType = 'start' | 'delta' | 'code' | 'spec' | 'retry' | 'error' | 'fallback' | 'done';
export type ModelVisibility = 'private' | 'public' | 'shared';
export type MaterialPreset =
  | 'cad-blue'
  | 'silver'
  | 'gold'
  | 'copper'
  | 'ceramic'
  | 'glass'
  | 'neon'
  | 'matte-black'
  | 'white'
  | 'steel';

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  tier: UserTier;
  bannedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CadParameter {
  name: string;
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
}

export interface CadModel {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  code: string;
  parameters: CadParameter[];
  category: string;
  tags: string[];
  material: MaterialPreset;
  visibility: ModelVisibility;
  likes: number;
  source?: 'manual' | 'ai' | 'imported';
  assetDataBase64?: string;
  assetMimeType?: string;
  assetFilename?: string;
  assetMetadata?: {
    byteLength: number;
    triangleCount?: number;
    importedAt?: string;
  };
  thumbnail?: string;
  shareToken?: string;
  publishedSnapshot?: {
    code: string;
    title: string;
    description: string;
    category: string;
    tags: string[];
    material: MaterialPreset;
    publishedAt: string;
  };
  revisionCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Template {
  id: string;
  title: string;
  description: string;
  code: string;
  category: string;
  tags: string[];
  material: MaterialPreset;
  featured: boolean;
  usageCount: number;
  sortOrder: number;
  createdAt: string;
}

export interface ShareToken {
  token: string;
  modelId: string;
  createdAt: string;
  expiresAt?: string;
}

export interface AdminStats {
  users: number;
  models: number;
  publicModels: number;
  orders: number;
  feedbacks: number;
}

export interface AiStreamEvent {
  type: AiStreamEventType;
  message?: string;
  delta?: string;
  code?: string;
  spec?: unknown;
  retryInMs?: number;
  attempt?: number;
  maxAttempts?: number;
  statusCode?: number;
  provider?: AiProvider;
  model?: string;
  source?: 'provider' | 'fallback';
}

const parameterLinePattern =
  /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(-?\d+(?:\.\d+)?)\s*\/\/\s*(.*?)\s*(?:unit:([^\s]+))?(?:\s+min:([-\d.]+))?(?:\s+max:([-\d.]+))?(?:\s+step:([-\d.]+))?\s*$/;

export function parseCadParameters(code: string): CadParameter[] {
  return code
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => parameterLinePattern.exec(line))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => {
      const [, name, rawValue, rawLabel, rawUnit, rawMin, rawMax, rawStep] = match;
      const label = rawLabel.replace(/\s*unit:[^\s]+.*/, '').trim();
      const value = Number(rawValue);
      return {
        name,
        label: label || name,
        value,
        unit: rawUnit ?? '',
        min: rawMin === undefined ? Math.min(0, value) : Number(rawMin),
        max: rawMax === undefined ? Math.max(value * 2, value + 1) : Number(rawMax),
        step: rawStep === undefined ? inferStep(value) : Number(rawStep)
      };
    });
}

export function applyCadParameters(code: string, parameters: CadParameter[]): string {
  const values = new Map(parameters.map((parameter) => [parameter.name, parameter.value]));
  return code.replace(
    /^((?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*)(-?\d+(?:\.\d+)?)(\s*\/\/.*)$/gm,
    (line, prefix: string, name: string, _oldValue: string, suffix: string) => {
      const value = values.get(name);
      return value === undefined ? line : `${prefix}${formatNumber(value)}${suffix}`;
    }
  );
}

function inferStep(value: number): number {
  return Number.isInteger(value) ? 1 : 0.1;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}
