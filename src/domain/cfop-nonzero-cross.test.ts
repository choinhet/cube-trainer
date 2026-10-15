// @vitest-environment node
import { expect, test } from "vitest";
import { Alg } from "cubing/alg";
import { puzzles } from "cubing/puzzles";
import { analyzeCFOP, cfopProgress } from "./cfop-analysis";
import { analyzeF2LPairs } from "./cfop-pairs";
import { analyzeLLAlgorithms } from "./cfop-algorithms";
import { SOLVED } from "./cube";
import type { TimedResult } from "./timed-attempt";
const f2l = "R U R' L' U' L R' U' R L U L'";
const oll = "R U R' U R U2 R'";
const pll = "R U R' U' R' F R2 U' R' U' R U R' F' U";
function trace(sequence: string): TimedResult {
  const moves = sequence.split(" ");
  return {
    id: "normal",
    sessionId: "s",
    status: "completed",
    startedAt: 0,
    rawDurationMs: (moves.length - 1) * 100,
    penalty: "none",
    timingBasis: "host-monotonic-receipt",
    facelets: SOLVED,
    rawTurns: moves.map((move, serial) => ({
      move,
      serial,
      hostMs: serial * 100,
      deviceMs: null,
    })),
  };
}
test("normal nonzero Cross, four pairs, OLL and PLL have independently verified cube endpoints", async () => {
  const result = trace(`F L B R ${f2l} ${oll} ${pll}`);
  const analysis = analyzeCFOP(result)!;
  expect(analysis.crossColor).toBe("yellow");
  expect(analysis.phases.map((p) => p.endIndex)).toEqual([4, 16, 23, 38]);
  const p = await puzzles["3x3x3"].kpuzzle();
  const states = result.rawTurns!.map((_, i) =>
    p.defaultPattern().applyAlg(
      new Alg(
        result
          .rawTurns!.slice(i)
          .map((m) => m.move)
          .join(" "),
      ).invert(),
    ),
  );
  const cross = (i: number) =>
    [4, 5, 6, 7].every(
      (slot) =>
        states[i].patternData.EDGES.pieces[slot] === slot &&
        !states[i].patternData.EDGES.orientation[slot],
    );
  expect([0, 1, 2, 3, 4].map(cross)).toEqual([
    false,
    false,
    false,
    false,
    true,
  ]);
  const pairsSolved = (index: number) =>
    [4, 5, 6, 7].filter((corner) => {
      const data = states[index].patternData,
        edge = corner + 4;
      return (
        data.CORNERS.pieces[corner] === corner &&
        data.CORNERS.orientation[corner] === 0 &&
        data.EDGES.pieces[edge] === edge &&
        data.EDGES.orientation[edge] === 0
      );
    }).length;
  expect([4, 7, 10, 13, 16].map(pairsSolved)).toEqual([0, 1, 2, 3, 4]);
  const oriented = (index: number) =>
    states[index].patternData.CORNERS.orientation.every(
      (value) => value === 0,
    ) &&
    states[index].patternData.EDGES.orientation.every((value) => value === 0);
  expect(oriented(16)).toBe(false);
  expect(oriented(23)).toBe(true);
  expect(analyzeF2LPairs(result, analysis).map((p) => p.endIndex)).toEqual([
    7, 10, 13, 16,
  ]);
  expect(analyzeLLAlgorithms(result, analysis).map((c) => c.label)).toEqual([
    "OLL - 27",
    "PLL - T",
  ]);
  expect(analysis.phases.reduce((sum, p) => sum + p.durationMs, 0)).toBe(
    result.rawDurationMs,
  );
});
test("normal nonzero Cross timing follows every proper cross-color rotation", () => {
  const frames = {
    yellow: "URFDLB",
    white: "DLFURB",
    red: "LUFRDB",
    orange: "RDFLUB",
    green: "BRUFLD",
    blue: "FRDBLU",
  } as const;
  for (const [color, frame] of Object.entries(frames)) {
    const result = trace(`F L B R ${f2l} ${oll} ${pll}`);
    result.rawTurns!.forEach((m) => {
      m.move = frame["URFDLB".indexOf(m.move[0])] + m.move.slice(1);
    });
    const analysis = analyzeCFOP(result)!;
    expect(analysis.crossColor, color).toBe(color);
    expect(
      analysis.phases.map((p) => p.endIndex),
      color,
    ).toEqual([4, 16, 23, 38]);
    expect(
      analyzeF2LPairs(result, analysis).map((p) => p.endIndex),
      color,
    ).toEqual([7, 10, 13, 16]);
    expect(
      analyzeLLAlgorithms(result, analysis).map((c) => c.label),
      color,
    ).toEqual(["OLL - 27", "PLL - T"]);
  }
});
test("a temporarily completed Cross followed by cross-face disruption completes only after restoration", () => {
  const result = trace(`F L B R D D' ${f2l} ${oll} ${pll}`);
  const analysis = analyzeCFOP(result)!;
  expect(cfopProgress(analysis.states[4], "yellow").cross).toBe(true);
  expect(cfopProgress(analysis.states[5], "yellow").cross).toBe(false);
  expect(cfopProgress(analysis.states[6], "yellow").cross).toBe(true);
  expect(analysis.crossColor).toBe("yellow");
  expect(analysis.phases.map((p) => p.endIndex)).toEqual([6, 18, 25, 40]);
});

test("exploratory U inverse turns keep the stable nonzero Cross boundary and become pair recognition", () => {
  const result = trace(`F L B R U U' ${f2l} ${oll} ${pll}`);
  const analysis = analyzeCFOP(result)!;
  expect(analysis.phases.map((p) => p.endIndex)).toEqual([4, 18, 25, 40]);
  expect(analyzeF2LPairs(result, analysis)[0].recognitionMs).toBe(300);
});
