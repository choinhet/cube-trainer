import { describe, expect, it } from "vitest";
import { angularDistance, CUBE_ORIENTATIONS, ganToRenderer, IDENTITY_ORIENTATION, multiply, nearestOrientation, normalize, orientationTransform, quaternionTransform, snapOrientation, type Quaternion } from "./cube-orientation";

function rotation(degrees: number, axis: [number, number, number]): Quaternion {
  const half = degrees * Math.PI / 360;
  const scale = Math.sin(half) / Math.hypot(...axis);
  return { x: axis[0] * scale, y: axis[1] * scale, z: axis[2] * scale, w: Math.cos(half) };
}

describe("cube orientation", () => {
  it("normalizes GAN input and maps its axial coordinates to the renderer", () => {
    expect(normalize({ x: 0, y: 0, z: 0, w: 4 })).toEqual({ x: 0, y: 0, z: 0, w: 1 });
    expect(ganToRenderer({ x: 1, y: 2, z: 2, w: 4 })).toEqual({ x: -0.2, y: 0.4, z: 0.4, w: 0.8 });
    expect(orientationTransform({ x: 0, y: 0, z: 0, w: 2 })).toBe("matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)");
  });

  it("chooses the nearest physical pose independently of quaternion sign or magnitude", () => {
    const sixty = { x: 0, y: 0.5, z: 0, w: Math.sqrt(3) / 2 };
    const quarter = { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 };
    expect(angularDistance(IDENTITY_ORIENTATION, sixty)).toBeCloseTo(60);
    expect(angularDistance(nearestOrientation(sixty), quarter)).toBeCloseTo(0);
    for (const pose of CUBE_ORIENTATIONS) {
      expect(angularDistance(nearestOrientation(pose), pose)).toBeCloseTo(0);
      const opposite = { x: -3 * pose.x, y: -3 * pose.y, z: -3 * pose.z, w: -3 * pose.w };
      expect(nearestOrientation(opposite)).toBe(nearestOrientation(pose));
    }
  });

  it.each<[number, number, number]>([[1, 0, 0], [0, 1, 0], [0, 0, 1]])("snaps the %s,%s,%s axis at 50 degrees and retains it until below 40", (...axis) => {
    const identity = nearestOrientation(IDENTITY_ORIENTATION);
    const quarter = nearestOrientation(rotation(90, axis));
    expect(snapOrientation(rotation(49.9, axis), identity)).toBe(identity);
    expect(snapOrientation(rotation(50, axis), identity)).toBe(quarter);
    for (const angle of [45, 49, 44, 40.1]) {
      expect(snapOrientation(rotation(angle, axis), quarter)).toBe(quarter);
    }
    expect(snapOrientation(rotation(39.9, axis), quarter)).toBe(identity);
    expect(snapOrientation(rotation(46, axis))).toBe(quarter);
    expect(snapOrientation(rotation(180, axis), identity)).toBe(nearestOrientation(rotation(180, axis)));
  });

  it("applies angular hysteresis to combined-axis motion and skipped sensor samples", () => {
    const identity = nearestOrientation(IDENTITY_ORIENTATION);
    const diagonal = nearestOrientation(rotation(120, [1, 1, 1]));
    expect(snapOrientation(rotation(64.9, [1, 1, 1]), identity)).toBe(identity);
    expect(snapOrientation(rotation(65, [1, 1, 1]), identity)).toBe(diagonal);
    expect(snapOrientation(rotation(55.1, [1, 1, 1]), diagonal)).toBe(diagonal);
    expect(snapOrientation(rotation(54.9, [1, 1, 1]), diagonal)).toBe(identity);
    const skipped = rotation(120, [1, 1, 1]);
    expect(snapOrientation(skipped, identity)).toBe(diagonal);
    expect(snapOrientation({ x: -skipped.x, y: -skipped.y, z: -skipped.z, w: -skipped.w }, diagonal)).toBe(diagonal);
  });

  it.each([null, { x: 0, y: 0, z: 0, w: 0 }, { x: NaN, y: 0, z: 0, w: 1 }, { x: 0, y: 0, z: 0, w: Infinity }])("retains the free-view identity fallback for %j", (sample) => {
    expect(orientationTransform(sample)).toBe("matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)");
  });

  it("provides all 24 proper cube poses, including every choice of top and front", () => {
    const matrices = CUBE_ORIENTATIONS.map((q) => quaternionTransform(q).slice(9, -1).split(",").map(Number));
    expect(matrices).toHaveLength(24);
    const facePairs = new Set<string>();
    for (const m of matrices) {
      // A proper cube pose maps each unit axis to one signed unit axis and
      // preserves handedness: right cross up is front.
      const right = [m[0], m[1], m[2]].map((value) => Math.round(value) || 0);
      const up = [m[4], m[5], m[6]].map((value) => Math.round(value) || 0);
      const front = [m[8], m[9], m[10]].map((value) => Math.round(value) || 0);
      expect(right.reduce((sum, value) => sum + Math.abs(value), 0)).toBe(1);
      expect(up.reduce((sum, value) => sum + Math.abs(value), 0)).toBe(1);
      expect([
        right[1] * up[2] - right[2] * up[1],
        right[2] * up[0] - right[0] * up[2],
        right[0] * up[1] - right[1] * up[0],
      ].map((value) => value || 0)).toEqual(front);
      facePairs.add(`${up.join(",")}/${front.join(",")}`);
    }
    expect(facePairs.size).toBe(24);
    const quarter = { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 };
    expect(multiply(quarter, quarter)).toMatchObject({ x: 0, z: 0, w: 0 });
    expect(multiply(quarter, quarter).y).toBeCloseTo(1);
  });
});
