import { parseCadParameters } from '@hicad/shared';

export interface DesignSpec {
  kind: 'box' | 'tank' | 'arm' | 'vehicle' | 'room' | 'generic';
  title: string;
  width: number;
  depth: number;
  height: number;
  material: string;
}

export function inferDesignSpec(prompt: string): DesignSpec {
  const normalized = prompt.toLowerCase();
  const numbers = [...prompt.matchAll(/(\d+(?:\.\d+)?)\s*(?:x|×|\*|乘|[，,]\s*)?/g)].map((match) => Number(match[1]));
  const [width = 80, depth = 50, height = 30] = numbers;
  const kind: DesignSpec['kind'] = normalized.includes('坦克')
    ? 'tank'
    : normalized.includes('机械臂')
      ? 'arm'
      : normalized.includes('汽车') || normalized.includes('车')
        ? 'vehicle'
        : normalized.includes('室内') || normalized.includes('房间') || normalized.includes('平面')
          ? 'room'
          : normalized.includes('盒') || normalized.includes('箱')
            ? 'box'
            : 'generic';
  return {
    kind,
    title: prompt.slice(0, 32) || '未命名模型',
    width,
    depth,
    height,
    material: pickMaterial(prompt)
  };
}

export function generateJscadCode(spec: DesignSpec): string {
  if (spec.kind === 'arm') {
    return `// @material: steel
const baseRadius = ${Math.max(Math.round(spec.width / 4), 20)} // 底座半径 unit:mm min:15 max:120 step:5
const armLength = ${Math.max(spec.width, 120)} // 主臂长度 unit:mm min:80 max:500 step:10
const forearmLength = ${Math.max(spec.depth, 80)} // 前臂长度 unit:mm min:60 max:400 step:10
const jointRadius = ${Math.max(Math.round(spec.height / 5), 12)} // 关节半径 unit:mm min:8 max:60 step:2

function main() {
  const base = cylinder({ radius: baseRadius, height: 18, segments: 40 })
  const shoulder = translate([0, 0, 34], sphere({ radius: jointRadius, segments: 24 }))
  const arm = translate([armLength / 2, 0, 52], cuboid({ size: [armLength, 16, 16] }))
  const elbow = translate([armLength, 0, 52], sphere({ radius: jointRadius, segments: 24 }))
  const forearm = translate([armLength + forearmLength / 2, 0, 76], cuboid({ size: [forearmLength, 14, 14] }))
  const wrist = translate([armLength + forearmLength, 0, 76], sphere({ radius: jointRadius * 0.72, segments: 20 }))
  return colorize([0.58, 0.62, 0.68], union(base, shoulder, arm, elbow, forearm, wrist))
}
module.exports = { main }
`;
  }

  if (spec.kind === 'vehicle') {
    return `// @material: cad-blue
const carLength = ${Math.max(spec.width, 120)} // 车身长度 unit:mm min:80 max:500 step:10
const carWidth = ${Math.max(spec.depth, 55)} // 车身宽度 unit:mm min:40 max:220 step:5
const carHeight = ${Math.max(spec.height, 35)} // 车身高度 unit:mm min:25 max:160 step:5
const wheelRadius = 14 // 轮半径 unit:mm min:8 max:40 step:1

function main() {
  const body = roundedCuboid({ size: [carLength, carWidth, carHeight], roundRadius: 8, segments: 20 })
  const cabin = translate([-carLength * 0.08, 0, carHeight * 0.62], roundedCuboid({ size: [carLength * 0.42, carWidth * 0.82, carHeight * 0.62], roundRadius: 6, segments: 16 }))
  const wheels = union(
    translate([-carLength * 0.32, -carWidth / 2, -carHeight * 0.28], cylinder({ radius: wheelRadius, height: 8, segments: 28 })),
    translate([carLength * 0.32, -carWidth / 2, -carHeight * 0.28], cylinder({ radius: wheelRadius, height: 8, segments: 28 })),
    translate([-carLength * 0.32, carWidth / 2, -carHeight * 0.28], cylinder({ radius: wheelRadius, height: 8, segments: 28 })),
    translate([carLength * 0.32, carWidth / 2, -carHeight * 0.28], cylinder({ radius: wheelRadius, height: 8, segments: 28 }))
  )
  return union(colorize([0.13, 0.44, 0.95], body), colorize([0.7, 0.9, 1], cabin), colorize([0.05, 0.06, 0.08], wheels))
}
module.exports = { main }
`;
  }

  if (spec.kind === 'tank') {
    return `// @material: steel
const bodyLength = ${Math.max(spec.width, 120)} // 车体长度 unit:mm min:80 max:400 step:5
const bodyWidth = ${Math.max(spec.depth, 60)} // 车体宽度 unit:mm min:40 max:200 step:5
const bodyHeight = ${Math.max(spec.height, 35)} // 车体高度 unit:mm min:20 max:120 step:5
const turretRadius = 22 // 炮塔半径 unit:mm min:10 max:60 step:1

function main() {
  const body = roundedCuboid({ size: [bodyLength, bodyWidth, bodyHeight], roundRadius: 6, segments: 16 })
  const turret = translate([0, 0, bodyHeight / 2 + 10], cylinder({ radius: turretRadius, height: 20, segments: 32 }))
  const barrel = translate([bodyLength / 2 + 24, 0, bodyHeight / 2 + 14], cuboid({ size: [48, 8, 8] }))
  return colorize([0.35, 0.42, 0.36], union(body, turret, barrel))
}
module.exports = { main }
`;
  }

  if (spec.kind === 'room') {
    return `// @material: cad-blue
const roomWidth = ${Math.max(spec.width, 3000)} // 房间宽度 unit:mm min:1000 max:10000 step:100
const roomDepth = ${Math.max(spec.depth, 2500)} // 房间深度 unit:mm min:1000 max:10000 step:100
const wallThick = 120 // 墙体厚度 unit:mm min:50 max:400 step:10
const wallHeight = ${Math.max(spec.height, 2400)} // 墙体高度 unit:mm min:2000 max:5000 step:100

function main() {
  const floor = cuboid({ size: [roomWidth, roomDepth, 80] })
  const backWall = translate([0, roomDepth / 2, wallHeight / 2], cuboid({ size: [roomWidth, wallThick, wallHeight] }))
  const leftWall = translate([-roomWidth / 2, 0, wallHeight / 2], cuboid({ size: [wallThick, roomDepth, wallHeight] }))
  return colorize([0.55, 0.8, 1], union(floor, backWall, leftWall))
}
module.exports = { main }
`;
  }

  return `// @material: ${spec.material}
const boxWidth = ${Math.max(spec.width, 10)} // 模型宽度 unit:mm min:10 max:500 step:5
const boxDepth = ${Math.max(spec.depth, 10)} // 模型深度 unit:mm min:10 max:500 step:5
const boxHeight = ${Math.max(spec.height, 10)} // 模型高度 unit:mm min:10 max:500 step:5
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
}

export function summarizeCode(code: string) {
  return {
    lineCount: code.split(/\r?\n/).length,
    parameters: parseCadParameters(code)
  };
}

function pickMaterial(prompt: string): string {
  if (/金|gold/i.test(prompt)) return 'gold';
  if (/铜|copper/i.test(prompt)) return 'copper';
  if (/玻璃|透明|glass/i.test(prompt)) return 'glass';
  if (/陶瓷|ceramic/i.test(prompt)) return 'ceramic';
  if (/金属|metal|steel/i.test(prompt)) return 'steel';
  return 'cad-blue';
}
