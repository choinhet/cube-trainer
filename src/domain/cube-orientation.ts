export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export const IDENTITY_ORIENTATION: Quaternion = { x: 0, y: 0, z: 0, w: 1 };

/** Invalid sensor samples use the same identity fallback as the free viewer. */
export function normalize(q: Quaternion): Quaternion {
  const length = Math.hypot(q.x, q.y, q.z, q.w);
  if (!Number.isFinite(length) || length === 0) return { ...IDENTITY_ORIENTATION };
  return { x: q.x / length, y: q.y / length, z: q.z / length, w: q.w / length };
}

/** GAN frame is +X red, +Y blue, +Z white; CSS is right/down/front.
 * Quaternion vector components are axial: this reflected basis negates X.
 */
export function ganToRenderer(q: Quaternion | null): Quaternion {
  const value = normalize(q ?? IDENTITY_ORIENTATION);
  return { x: -value.x, y: value.z, z: value.y, w: value.w };
}

export function quaternionTransform({ x, y, z, w }: Quaternion): string {
  return `matrix3d(${[1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0, 2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0, 2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0, 0, 0, 0, 1].join(",")})`;
}

export function orientationTransform(q: Quaternion | null): string {
  return quaternionTransform(ganToRenderer(q));
}

/** Hamilton product: apply b first, then a. */
export function multiply(a: Quaternion, b: Quaternion): Quaternion {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

function cubeOrientations(): readonly Quaternion[] {
  const orientations = [{ ...IDENTITY_ORIENTATION }];
  const quarterTurns = [
    { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 },
    { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 },
  ];
  for (let i = 0; i < orientations.length; i++) {
    for (const turn of quarterTurns) {
      const next = normalize(multiply(turn, orientations[i]));
      if (!orientations.some((q) => Math.abs(q.x * next.x + q.y * next.y + q.z * next.z + q.w * next.w) > 1 - 1e-10)) {
        orientations.push(next);
      }
    }
  }
  return orientations;
}

/** The rotation group of the cube, in renderer coordinates; identity first. */
export const CUBE_ORIENTATIONS = cubeOrientations();

/** Shortest physical rotation in degrees; q and -q describe the same pose. */
export function angularDistance(a: Quaternion, b: Quaternion): number {
  const first = normalize(a), second = normalize(b);
  const dot = Math.abs(first.x * second.x + first.y * second.y + first.z * second.z + first.w * second.w);
  return 2 * Math.acos(Math.min(1, dot)) * 180 / Math.PI;
}

export function nearestOrientation(q: Quaternion): Quaternion {
  let best = CUBE_ORIENTATIONS[0];
  let distance = angularDistance(q, best);
  for (const candidate of CUBE_ORIENTATIONS.slice(1)) {
    const next = angularDistance(q, candidate);
    if (next < distance) {
      best = candidate;
      distance = next;
    }
  }
  return best;
}

/** Retain the current cube pose until another is at least 10 degrees closer.
 * A quarter-turn thus switches at 50 degrees and returns at 40 degrees.
 * An omitted current pose initializes directly to the nearest orientation.
 */
export function snapOrientation(q: Quaternion, current: Quaternion | null = null): Quaternion {
  const best = nearestOrientation(q);
  if (!current) return best;
  const improvement = angularDistance(q, current) - angularDistance(q, best);
  return improvement >= 10 - 1e-8 ? best : current;
}
