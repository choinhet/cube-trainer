import { expect, test } from 'vitest';
import { historyScramble } from './history-scramble';
import { SOLVED, turn } from './cube';
import type { TimedResult } from './timed-attempt';
const moves = "L L F F L' B' L F F L' B L' D' D L D D L' D' L D' L'".split(' ');
const inverse = (move: string) => move.endsWith('2') ? move : move.endsWith("'") ? move[0] : `${move}'`;
function result(): TimedResult {
  return { id: 's', sessionId: 's', startedAt: 0, status: 'completed', rawDurationMs: 2000, penalty: 'none', timingBasis: 'host-monotonic-receipt', facelets: SOLVED, rawTurns: moves.slice().reverse().map(inverse).map((move, serial) => ({ move, serial, hostMs: serial * 100, deviceMs: null })) };
}
test('combines repeated turns and cancellations without changing the reconstructed starting position or solve trace', () => {
  const input = result(); const before = structuredClone(input);
  const scramble = historyScramble(input)!;
  expect(scramble.equivalent).toBe(true);
  expect(scramble.moves.slice(0, 2)).toEqual(['L2', 'F2']);
  expect(scramble.moves.every((move, i, all) => i === 0 || move[0] !== all[i - 1][0])).toBe(true);
  expect(scramble.moves.reduce(turn, SOLVED)).toBe(moves.reduce(turn, SOLVED));
  expect(input).toEqual(before);
});
test('uses the original saved scramble instead of reverse-engineering the solve', () => {
  expect(historyScramble({ ...result(), originalScramble: "R R U F2" })).toEqual({ equivalent: false, moves: ['R2', 'U', 'F2'] });
});
test('does not reconstruct a starting position from an interrupted solve or missing physical moves', () => {
  expect(historyScramble({ ...result(), status: 'interrupted' })).toBeNull();
  const input = result(); input.rawTurns![1].serial++;
  expect(historyScramble(input)).toBeNull();
});
