import type { CadParameter } from '@hicad/shared';
import { applyCadParameters, parseCadParameters } from '@hicad/shared';

export interface ParameterGroup {
  name: string;
  parameters: CadParameter[];
}

export interface ParameterBounds {
  min: number;
  max: number;
  step: number;
  value: number;
}

export function groupCadParameters(code: string): ParameterGroup[] {
  const groups = new Map<string, CadParameter[]>();
  for (const parameter of parseCadParameters(code)) {
    const [groupName, label] = splitGroupLabel(parameter.label);
    const normalized = { ...parameter, label };
    groups.set(groupName, [...(groups.get(groupName) ?? []), normalized]);
  }
  return Array.from(groups, ([name, parameters]) => ({ name, parameters }));
}

export function normalizeParameterValue(parameter: ParameterBounds, rawValue: number): number {
  if (!Number.isFinite(rawValue)) return parameter.value;
  const clamped = Math.min(parameter.max, Math.max(parameter.min, rawValue));
  const stepped = parameter.step > 0 ? Math.round((clamped - parameter.min) / parameter.step) * parameter.step + parameter.min : clamped;
  return Number(Number(stepped).toFixed(4));
}

export function resetParameterDefaults(code: string, defaults?: Record<string, number>): string {
  const parameters = parseCadParameters(code).map((parameter) => ({
    ...parameter,
    value: defaults?.[parameter.name] ?? parameter.value
  }));
  return applyCadParameters(code, parameters);
}

export function captureParameterDefaults(code: string): Record<string, number> {
  return Object.fromEntries(parseCadParameters(code).map((parameter) => [parameter.name, parameter.value]));
}

function splitGroupLabel(label: string): [string, string] {
  const [group, rest] = label.split(/[/:：]/, 2).map((item) => item.trim());
  if (rest) return [group || '默认', rest || label];
  return ['默认', label];
}
