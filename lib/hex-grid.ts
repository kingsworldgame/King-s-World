export type AxialCoord = {
  q: number;
  r: number;
};

export type CubeCoord = {
  q: number;
  r: number;
  s: number;
};

export type PixelPoint = {
  x: number;
  y: number;
};

export type HexOrientation = "pointy" | "flat";

export type HexLayout = {
  orientation: HexOrientation;
  size: number;
  origin: PixelPoint;
};

export type HexBounds = {
  minQ: number;
  maxQ: number;
  minR: number;
  maxR: number;
};

const SQRT3 = Math.sqrt(3);
const DIRECTION_COUNT = 6;

export const AXIAL_DIRECTIONS: readonly AxialCoord[] = Object.freeze([
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
]);

export function axialKey(coord: AxialCoord): string {
  return `${coord.q},${coord.r}`;
}

export function parseAxialKey(key: string): AxialCoord | null {
  const parts = key.split(",");
  if (parts.length !== 2) {
    return null;
  }
  const q = Number.parseInt(parts[0] ?? "", 10);
  const r = Number.parseInt(parts[1] ?? "", 10);
  if (!Number.isFinite(q) || !Number.isFinite(r)) {
    return null;
  }
  return { q, r };
}

export function axialToCube(coord: AxialCoord): CubeCoord {
  return { q: coord.q, r: coord.r, s: -coord.q - coord.r };
}

export function cubeToAxial(coord: CubeCoord): AxialCoord {
  return { q: coord.q, r: coord.r };
}

export function addAxial(a: AxialCoord, b: AxialCoord): AxialCoord {
  return { q: a.q + b.q, r: a.r + b.r };
}

export function subtractAxial(a: AxialCoord, b: AxialCoord): AxialCoord {
  return { q: a.q - b.q, r: a.r - b.r };
}

export function scaleAxial(coord: AxialCoord, factor: number): AxialCoord {
  return { q: coord.q * factor, r: coord.r * factor };
}

export function normalizeDirectionIndex(direction: number): number {
  const mod = direction % DIRECTION_COUNT;
  return mod < 0 ? mod + DIRECTION_COUNT : mod;
}

export function axialNeighbor(coord: AxialCoord, direction: number): AxialCoord {
  const vector = AXIAL_DIRECTIONS[normalizeDirectionIndex(direction)]!;
  return addAxial(coord, vector);
}

export function axialNeighbors(coord: AxialCoord): AxialCoord[] {
  return AXIAL_DIRECTIONS.map((vector) => addAxial(coord, vector));
}

export function cubeDistance(a: CubeCoord, b: CubeCoord): number {
  return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.s - b.s));
}

export function axialDistance(a: AxialCoord, b: AxialCoord): number {
  return cubeDistance(axialToCube(a), axialToCube(b));
}

export function inHexBounds(coord: AxialCoord, bounds: HexBounds): boolean {
  return coord.q >= bounds.minQ && coord.q <= bounds.maxQ && coord.r >= bounds.minR && coord.r <= bounds.maxR;
}

function assertLayout(layout: HexLayout): void {
  if (!Number.isFinite(layout.size) || layout.size <= 0) {
    throw new Error("Hex layout size must be a finite number > 0.");
  }
}

export function axialToPixel(coord: AxialCoord, layout: HexLayout): PixelPoint {
  assertLayout(layout);
  const { size, origin, orientation } = layout;

  if (orientation === "pointy") {
    return {
      x: size * SQRT3 * (coord.q + coord.r / 2) + origin.x,
      y: size * (3 / 2) * coord.r + origin.y,
    };
  }

  return {
    x: size * (3 / 2) * coord.q + origin.x,
    y: size * SQRT3 * (coord.r + coord.q / 2) + origin.y,
  };
}

export function pixelToFractionalAxial(point: PixelPoint, layout: HexLayout): AxialCoord {
  assertLayout(layout);
  const { size, origin, orientation } = layout;
  const px = point.x - origin.x;
  const py = point.y - origin.y;

  if (orientation === "pointy") {
    return {
      q: ((SQRT3 / 3) * px - (1 / 3) * py) / size,
      r: ((2 / 3) * py) / size,
    };
  }

  return {
    q: ((2 / 3) * px) / size,
    r: ((-1 / 3) * px + (SQRT3 / 3) * py) / size,
  };
}

export function cubeRound(fractional: CubeCoord): CubeCoord {
  let q = Math.round(fractional.q);
  let r = Math.round(fractional.r);
  let s = Math.round(fractional.s);

  const qDiff = Math.abs(q - fractional.q);
  const rDiff = Math.abs(r - fractional.r);
  const sDiff = Math.abs(s - fractional.s);

  if (qDiff > rDiff && qDiff > sDiff) {
    q = -r - s;
  } else if (rDiff > sDiff) {
    r = -q - s;
  } else {
    s = -q - r;
  }

  return { q, r, s };
}

export function axialRound(fractional: AxialCoord): AxialCoord {
  const cube = axialToCube(fractional);
  return cubeToAxial(cubeRound(cube));
}

export function pixelToAxial(point: PixelPoint, layout: HexLayout): AxialCoord {
  return axialRound(pixelToFractionalAxial(point, layout));
}

function cubeLerp(a: CubeCoord, b: CubeCoord, t: number): CubeCoord {
  return {
    q: a.q + (b.q - a.q) * t,
    r: a.r + (b.r - a.r) * t,
    s: a.s + (b.s - a.s) * t,
  };
}

export function hexLine(from: AxialCoord, to: AxialCoord): AxialCoord[] {
  const distance = axialDistance(from, to);
  if (distance === 0) {
    return [{ q: from.q, r: from.r }];
  }

  const a = axialToCube(from);
  const b = axialToCube(to);
  const points: AxialCoord[] = [];
  for (let step = 0; step <= distance; step += 1) {
    const t = step / distance;
    points.push(cubeToAxial(cubeRound(cubeLerp(a, b, t))));
  }
  return points;
}

export function hexCorners(coord: AxialCoord, layout: HexLayout): PixelPoint[] {
  const center = axialToPixel(coord, layout);
  const startAngle = layout.orientation === "pointy" ? -30 : 0;
  const corners: PixelPoint[] = [];

  for (let i = 0; i < DIRECTION_COUNT; i += 1) {
    const angleDeg = startAngle + i * 60;
    const angleRad = (Math.PI / 180) * angleDeg;
    corners.push({
      x: center.x + layout.size * Math.cos(angleRad),
      y: center.y + layout.size * Math.sin(angleRad),
    });
  }

  return corners;
}
