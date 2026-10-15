import { expect, it } from 'vitest';
import { analyzeCFOP } from './cfop-analysis';
import { analyzeF2LPairs } from './cfop-pairs';
import { SOLVED } from './cube';
import type { TimedResult } from './timed-attempt';

function trace(sequence: string): TimedResult {
  const moves = sequence.split(' ');
  return { id: 'pairs', sessionId: 's', status: 'completed', startedAt: 0, rawDurationMs: (moves.length - 1) * 100, penalty: 'none', timingBasis: 'host-monotonic-receipt', facelets: SOLVED, rawTurns: moves.map((move, serial) => ({ move, serial, hostMs: serial * 100, deviceMs: null })) };
}
it('exposes all four distinct pairs in physical completion order with recognition at the first solution turn', () => {
  const result = trace("R U R' L' U' L R' U' R L U L' U");
  const analysis = analyzeCFOP(result)!;
  const pairs = analyzeF2LPairs(result, analysis);
  expect(pairs.map(pair => pair.endIndex)).toEqual([3, 6, 9, 12]);
  expect(new Set(pairs.map(pair => pair.id)).size).toBe(4);
  expect(pairs.map(pair => pair.id)).toEqual(['pair-0', 'pair-2', 'pair-1', 'pair-3']);
  expect(pairs.map(pair => pair.recognitionMs)).toEqual([0, 100, 100, 100]);
  expect(pairs.map(pair => pair.executionMs)).toEqual([200, 200, 200, 200]);
});
it('follows another insertion order and rejects a temporarily completed pair boundary', () => {
  const alternate = trace("L U L' R' U' R L' U' L R U R' U");
  expect(analyzeF2LPairs(alternate, analyzeCFOP(alternate)!).map(pair => pair.id)).toEqual(['pair-3', 'pair-1', 'pair-2', 'pair-0']);
  const transient = trace("R U R' R U' R' R U R' L' U' L R' U' R L U L' U");
  expect(analyzeF2LPairs(transient, analyzeCFOP(transient)!).map(pair => pair.endIndex)).toEqual([9, 12, 15, 18]);
});
it('keeps exploratory U inverses in recognition and a long pause inside insertion in execution', () => {
  const result = trace("R U R' U U' L' U' L R' U' R L U L' U");
  result.rawTurns!.forEach((move, index) => { if (index >= 6) move.hostMs += 5000; });
  result.rawDurationMs += 5000;
  const original = structuredClone(result.rawTurns);
  const pairs = analyzeF2LPairs(result, analyzeCFOP(result)!);
  expect(pairs[1].recognitionMs).toBe(300);
  expect(pairs[1].executionMs).toBe(5200);
  expect(pairs[1].solutionStartIndex).toBe(5);
  expect(result.rawTurns).toEqual(original);
});
it('allows skipped pairs and immediate lookahead without inventing recognition time', () => {
  const result = trace("R U R' U");
  const pairs = analyzeF2LPairs(result, analyzeCFOP(result)!);
  expect(pairs.map(pair => pair.executionMs)).toEqual([0, 0, 0, 200]);
  expect(pairs.every(pair => pair.recognitionMs === 0)).toBe(true);
  const immediate = trace("R U R' L' U' L R' U' R L U L' U");
  immediate.rawTurns![3].hostMs = 200;
  expect(analyzeF2LPairs(immediate, analyzeCFOP(immediate)!)[1].recognitionMs).toBe(0);
});
it('includes setup U turns in execution and analyzes another Cross color', () => {
  const setup = trace("R U R' U L' U' L R' U' R L U L' U");
  const setupPair = analyzeF2LPairs(setup, analyzeCFOP(setup)!)[1];
  expect(setupPair.solutionStartIndex).toBe(3);
  expect(setupPair.executionMs).toBe(300);
  const rotated = trace("R U R' L' U' L R' U' R L U L' U");
  const rotation: Record<string, string> = { U: 'R', R: 'D', D: 'L', L: 'U', F: 'F', B: 'B' };
  rotated.rawTurns!.forEach(move => { move.move = rotation[move.move[0]] + move.move.slice(1); });
  const analysis = analyzeCFOP(rotated)!;
  expect(analysis.crossColor).toBe('orange');
  expect(analyzeF2LPairs(rotated, analysis).map(pair => pair.endIndex)).toEqual([3, 6, 9, 12]);
});

