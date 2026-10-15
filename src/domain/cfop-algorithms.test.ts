import { expect, test } from "vitest";
import { analyzeCFOP } from "./cfop-analysis";
import { analyzeLLAlgorithms } from "./cfop-algorithms";
import { SOLVED } from "./cube";
import type { TimedResult } from "./timed-attempt";
const sune = "R U R' U R U2 R'";
const t = "R U R' U' R' F R2 U' R' U' R U R' F'";
function result(sequence: string): TimedResult {
  const moves = sequence.split(" ");
  return {
    id: "a",
    sessionId: "s",
    status: "completed",
    startedAt: 0,
    rawDurationMs: moves.length * 100,
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
test("names direct OLL and PLL while preserving setup, pauses, final alignment and raw trace", () => {
  const input = result(`R U R' U U' U ${sune} U ${t} U`),
    original = structuredClone(input);
  const analysis = analyzeCFOP(input)!;
  const cases = analyzeLLAlgorithms(input, analysis);
  expect(cases.map((c) => c.label)).toEqual(["OLL - 27", "PLL - T"]);
  expect(cases[0].recognitionMs).toBe(300);
  expect(cases[1].endMs).toBe(input.rawDurationMs);
  expect(input).toEqual(original);
});

test("splits edge and corner orientation at their state milestone", () => {
  const input = result(`F R U R' U' F' ${sune}`);
  const analysis = analyzeCFOP(input)!;
  expect(analyzeLLAlgorithms(input, analysis).map((c) => c.label)).toEqual([
    "OLL - Line",
    "OLL - Sune",
  ]);
});
test("retains unknown OLL state progress through an internal identity detour", () => {
  const input = result(`R U R' R R U U' R' U R' U R U2 R' ${t}`);
  const analysis = analyzeCFOP(input)!;
  expect(analysis.phases.map((p) => p.endIndex)).toEqual([0, 3, 14, 28]);
  expect(analyzeLLAlgorithms(input, analysis).map((c) => c.label)).toEqual([
    "OLL - Unrecognized",
    "PLL - T",
  ]);
});
test("supports repeated named algorithms and consecutive PLL operations without inferring intent", () => {
  const input = result(`${t} ${t} R U' R U R U R U' R' U' R2`);
  const analysis = analyzeCFOP(input)!;
  expect(analyzeLLAlgorithms(input, analysis).map((c) => c.label)).toEqual([
    "PLL - T",
    "PLL - T",
    "PLL - Ua",
  ]);
});
test("recognizes equivalent half-turn spelling and a different cross orientation", () => {
  const input = result(t.replace("R2", "R R") + " U");
  const map = "DLFURB";
  input.rawTurns = input.rawTurns!.map((m) => ({
    ...m,
    move: map["URFDLB".indexOf(m.move[0])] + m.move.slice(1),
  }));
  const analysis = analyzeCFOP(input)!;
  expect(analysis.crossColor).toBe("white");
  expect(analyzeLLAlgorithms(input, analysis).map((c) => c.label)).toEqual([
    "PLL - T",
  ]);
});
test("keeps unknown algorithms together without treating a pause as another case", () => {
  const input = result(`R U R' U U' R R U U' R' U R' U R U2 R' ${t}`);
  for (let i = 7; i < input.rawTurns!.length; i++)
    input.rawTurns![i].hostMs += 2000;
  input.rawDurationMs += 2000;
  const analysis = analyzeCFOP(input)!;
  const cases = analyzeLLAlgorithms(input, analysis);
  expect(cases.map((c) => c.label)).toEqual(["OLL - Unrecognized", "PLL - T"]);
  expect(cases[0].solutionStartIndex).toBe(5);
  expect(cases[0].executionMs).toBeGreaterThan(2000);
  expect(
    cases.reduce((sum, c) => sum + c.recognitionMs + c.executionMs, 0),
  ).toBe(analysis.phases.slice(2).reduce((sum, p) => sum + p.durationMs, 0));
});
test("unknown edge operation still exposes the independent two-look milestone", () => {
  const input = result(`F R R U U' R' U R' U' F' ${sune}`);
  const analysis = analyzeCFOP(input)!;
  expect(analyzeLLAlgorithms(input, analysis).map((c) => c.label)).toEqual([
    "OLL - Unrecognized (edges)",
    "OLL - Sune",
  ]);
});
test("analyzes a representative 193-turn trace and reuses the offline match index", () => {
  const input = result(
    `${Array.from({ length: 13 }, () => t).join(" ")} R U' R U R U R U' R' U' R2`,
  );
  const start = performance.now();
  const analysis = analyzeCFOP(input)!;
  const cases = analyzeLLAlgorithms(input, analysis);
  expect(cases).toHaveLength(14);
  expect(performance.now() - start).toBeLessThan(2000);
});
test("rejects a transient F2L completion that returns through an unsupported identity detour", () => {
  const input = result(`R U R' R U' R' ${sune} ${t}`);
  const analysis = analyzeCFOP(input)!;
  expect(analysis.phases.map((p) => p.endIndex)).toEqual([6, 6, 13, 27]);
});
test("an alignment-only PLL interval is execution through the authoritative stop", () => {
  const input = result(`${sune} U`);
  const analysis = analyzeCFOP(input)!;
  const alignment = analyzeLLAlgorithms(input, analysis).find(
    (c) => c.phase === "PLL",
  )!;
  expect(alignment.recognitionMs).toBe(0);
  expect(alignment.executionMs).toBe(analysis.phases[3].durationMs);
});
test("keeps OLL and PLL skipped when the final F2L insertion solves the cube", () => {
  const analysis = analyzeCFOP(result("R U R'"))!;
  expect(analysis.phases.map((p) => p.endIndex)).toEqual([0, 3, 3, 3]);
  expect(analyzeLLAlgorithms(result("R U R'"), analysis)).toEqual([]);
});
