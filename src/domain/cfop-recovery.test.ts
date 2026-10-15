import { expect, it } from 'vitest';
import { analyzeCFOP } from './cfop-analysis';
import { SOLVED } from './cube';
import type { TimedResult } from './timed-attempt';

function solve(): TimedResult {
  const moves = "R U R' R U R' U R U2 R' R U R' U' R' F R2 U' R' U' R U R' F' U".split(' ');
  return { id: 'legacy', sessionId: 'original', status: 'completed', startedAt: 1790000000000, rawDurationMs: 2400.125, penalty: 'none', timingBasis: 'host-monotonic-receipt', facelets: SOLVED, rawTurns: moves.map((move, index) => ({ move, serial: (250 + index) % 256, hostMs: 1000 + index * 100, deviceMs: index * 20 })) };
}

it('recovers bounded interior move times using device spacing while preserving physical moves and raw precision', () => {
  const input = solve();
  input.rawTurns![1].hostMs = null as unknown as number;
  input.rawTurns![1].deviceMs = 5;
  const original = structuredClone(input);
  const analysis = analyzeCFOP(input)!;
  expect(analysis).not.toBeNull();
  expect(analysis.moveTimesMs.slice(0, 3)).toEqual([0, 25, 200]);
  expect(analysis.phases.map(phase => phase.endIndex)).toEqual([0, 3, 10, 25]);
  expect(analysis.phases.reduce((sum, phase) => sum + phase.durationMs, 0)).toBe(2400.125);
  expect(input).toEqual(original);
});

it('retains recovered moves sharing receipt time and spaces them inside surrounding host anchors without device timestamps', () => {
  const input = solve();
  input.rawTurns![1] = { ...input.rawTurns![1], hostMs: 1300, deviceMs: null, recovered: true };
  input.rawTurns![2] = { ...input.rawTurns![2], hostMs: 1300, deviceMs: null, recovered: true };
  input.rawTurns!.forEach(move => { move.deviceMs = null; });
  const analysis = analyzeCFOP(input)!;
  expect(analysis.moveTimesMs.slice(0, 4)).toEqual([0, 100, 200, 300]);
  expect(input.rawTurns).toHaveLength(25);
  expect(analyzeCFOP({ ...input, penalty: 'dnf' })).toEqual(analysis);
});

it('uses a durable host origin when legacy boundary timestamps are absent and bounds the last move by the raw stop', () => {
  const input = { ...solve(), solveStartHostMs: 1000 };
  input.rawTurns![0].hostMs = NaN;
  input.rawTurns![24].hostMs = NaN;
  const analysis = analyzeCFOP(input)!;
  expect(analysis).not.toBeNull();
  expect(analysis.moveTimesMs[0]).toBe(0);
  expect(analysis.moveTimesMs[24]).toBe(2400.125);
  expect(analysis.phases.reduce((sum, phase) => sum + phase.durationMs, 0)).toBe(2400.125);
});

it('anchors a legacy missing first timestamp to its final receipt and preserves device timing as spacing only', () => {
  const input = solve();
  input.rawTurns![0].hostMs = undefined as unknown as number;
  const analysis = analyzeCFOP(input)!;
  expect(analysis).not.toBeNull();
  expect(analysis.moveTimesMs.slice(0, 3)).toEqual([0, 100.125, 200.125]);
  expect(analysis.moveTimesMs.at(-1)).toBe(2400.125);
});

it('preserves totals with unavailable details when traces have no usable timing or full state evidence', () => {
  const input = solve();
  input.rawTurns!.forEach(move => { move.hostMs = null as unknown as number; move.deviceMs = null; });
  const original = structuredClone(input);
  expect(analyzeCFOP(input)).toBeNull();
  expect(analyzeCFOP({ ...solve(), facelets: null })).toBeNull();
  expect(input).toEqual(original);
});

it('rejects a serial gap or reversed receipt order while keeping coherent zero-width live receipt intervals', () => {
  const input = solve();
  input.rawTurns![2].hostMs = 1100;
  expect(analyzeCFOP(input)!.moveTimesMs.slice(0, 3)).toEqual([0, 100, 100]);
  input.rawTurns![2] = { ...input.rawTurns![2], hostMs: 1050, recovered: true };
  expect(analyzeCFOP(input)).toBeNull();
  input.rawTurns![2] = { ...input.rawTurns![2], hostMs: 1200, serial: 5 };
  expect(analyzeCFOP(input)).toBeNull();
});

it('uses serial spacing when device timestamps reset and never moves a recovered turn past its delivery receipt', () => {
  const input = solve();
  input.rawTurns![1] = { ...input.rawTurns![1], hostMs: 1020, deviceMs: 500, recovered: true };
  input.rawTurns![2] = { ...input.rawTurns![2], hostMs: NaN, deviceMs: 10 };
  const analysis = analyzeCFOP(input)!;
  expect(analysis.moveTimesMs.slice(0, 4)).toEqual([0, 20, 200, 300]);
  expect(analysis.moveTimesMs.every((time, index, all) => time >= 0 && time <= 2400.125 && (index === 0 || time >= all[index - 1]))).toBe(true);
});

it('uses a coherent device-only legacy trace within the raw interval without treating the device clock as calibrated', () => {
  const input = solve();
  input.rawTurns!.forEach(move => { move.hostMs = NaN; });
  const analysis = analyzeCFOP(input)!;
  expect(analysis).not.toBeNull();
  expect(analysis.moveTimesMs[0]).toBe(0);
  expect(analysis.moveTimesMs[12]).toBe(1200.0625);
  expect(analysis.moveTimesMs.at(-1)).toBe(2400.125);
  expect(input.rawTurns![24].deviceMs).toBe(480);
});

it('bounds missing boundary timestamps by interior host anchors and the raw solve interval', () => {
  const input = solve();
  input.rawTurns![0].hostMs = NaN;
  input.rawTurns![24].hostMs = NaN;
  const analysis = analyzeCFOP(input)!;
  expect(analysis).not.toBeNull();
  expect(analysis.moveTimesMs.slice(0, 3)).toEqual([0, 100.0625, 200.0625]);
  expect(analysis.moveTimesMs.at(-1)).toBe(2400.125);
});
