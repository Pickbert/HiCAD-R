import type { CadParameter, MaterialPreset } from '@hicad/shared';
import { parseCadParameters } from '@hicad/shared';

export interface PreviewSummary {
  material: MaterialPreset;
  parameters: CadParameter[];
  dimensions: {
    width: number;
    depth: number;
    height: number;
  };
}

const materials: MaterialPreset[] = [
  'cad-blue',
  'silver',
  'gold',
  'copper',
  'ceramic',
  'glass',
  'neon',
  'matte-black',
  'white',
  'steel'
];

export function buildPreviewSummary(code: string): PreviewSummary {
  const parameters = parseCadParameters(code);
  const width = findDimension(parameters, ['width', 'length', 'roomWidth', 'bodyLength', 'boxWidth'], 80);
  const depth = findDimension(parameters, ['depth', 'roomDepth', 'bodyWidth', 'boxDepth'], 50);
  const height = findDimension(parameters, ['height', 'roomHeight', 'bodyHeight', 'boxHeight', 'wallHeight'], 30);
  const materialMatch = /@material:\s*([A-Za-z0-9_-]+)/.exec(code);
  const material = materials.includes(materialMatch?.[1] as MaterialPreset)
    ? (materialMatch?.[1] as MaterialPreset)
    : 'cad-blue';
  return {
    material,
    parameters,
    dimensions: { width, depth, height }
  };
}

export function exportStlAscii(summary: PreviewSummary, name = 'hicad-model'): string {
  const { width, depth, height } = summary.dimensions;
  return `solid ${name}
  facet normal 0 0 1
    outer loop
      vertex ${-width / 2} ${-depth / 2} ${height / 2}
      vertex ${width / 2} ${-depth / 2} ${height / 2}
      vertex ${width / 2} ${depth / 2} ${height / 2}
    endloop
  endfacet
endsolid ${name}
`;
}

function findDimension(parameters: CadParameter[], names: string[], fallback: number): number {
  const exact = parameters.find((parameter) => names.includes(parameter.name));
  if (exact) return exact.value;
  const fuzzy = parameters.find((parameter) =>
    names.some((name) => parameter.name.toLowerCase().includes(name.toLowerCase()))
  );
  return fuzzy?.value ?? fallback;
}
