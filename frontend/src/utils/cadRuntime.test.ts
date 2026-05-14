import { describe, expect, it } from 'vitest';
import { runCadRuntime } from './cadRuntime.js';

describe('cad runtime', () => {
  it('executes JSCAD main with common modeling APIs, color groups, part tree, and stats', () => {
    const result = runCadRuntime({
      code: `
function main() {
  const body = colorize([1, 0, 0], cuboid({ size: [20, 10, 8] }))
  const cap = colorize([0, 0, 1], translate([0, 0, 8], sphere({ radius: 4, segments: 8 })))
  const cut = translate([0, 0, 1], cylinder({ radius: 2, height: 12, segments: 8 }))
  return [
    subtract(rotate([0, 0, Math.PI / 6], body), cut),
    roundedCuboid({ size: [8, 8, 4], roundRadius: 1, segments: 8 }),
    cap
  ]
}
module.exports = { main }
`
    });

    expect(result.meshes.length).toBeGreaterThanOrEqual(2);
    expect(result.parts.map((part) => part.name)).toEqual(['part-1', 'part-2', 'part-3']);
    expect(result.stats.triangleCount).toBeGreaterThan(0);
    expect(result.stats.vertexCount).toBeGreaterThan(0);
    expect(result.stats.boundingBox.width).toBeGreaterThan(0);
    expect(result.stats.drawCallCount).toBe(result.meshes.length);
    expect(result.meshes.some((mesh) => mesh.material === 'colorized')).toBe(true);
  });

  it('captures JSCAD exceptions as structured runtime errors', () => {
    expect(() => runCadRuntime({ code: 'function main() { throw new Error("bad model") }' })).toThrow(/bad model/);
  });

  it('blocks dangerous browser and dynamic execution tokens before running code', () => {
    expect(() => runCadRuntime({ code: 'function main() { return fetch("https://example.com") }' })).toThrow(/unsafe token/i);
    expect(() => runCadRuntime({ code: 'function main() { return Function("return 1")() }' })).toThrow(/unsafe token/i);
  });

  it('stops overly complex models before returning large buffers', () => {
    expect(() =>
      runCadRuntime({
        code: 'function main() { return cuboid({ size: [10, 10, 10] }) }',
        maxTriangles: 1
      })
    ).toThrow(/triangle limit/i);
  });

  it('honors material comments and splits multicolor results into color groups', () => {
    const result = runCadRuntime({
      code: `// @material: gold
function main() {
  return [
    cuboid({ size: [10, 10, 10] }),
    colorize([0, 0.8, 1], translate([12, 0, 0], cuboid({ size: [6, 6, 6] })))
  ]
}`
    });

    expect(result.meshes.map((mesh) => mesh.material).sort()).toEqual(['colorized', 'gold']);
    expect(result.parts).toHaveLength(2);
  });
});
