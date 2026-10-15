import { describe, expect, it } from 'vitest';
import { SOLVED, turn } from './cube';
import { analyzeCFOP } from './cfop-analysis';
import type { TimedResult } from './timed-attempt';

function result(moves: string[]): TimedResult {
  return { id: 'a', sessionId: 's', status: 'completed', startedAt: 0, rawDurationMs: 1200.125, penalty: 'none', timingBasis: 'host-monotonic-receipt', facelets: SOLVED, rawTurns: moves.map((move, serial) => ({ move, serial, hostMs: 100 + serial * 1200.125 / Math.max(1, moves.length - 1), deviceMs: null })) };
}
describe('completed solve CFOP analysis', () => {
  it('assigns an alignment-only solve to PLL and preserves the exact raw total', () => {
    const input = result(['U', 'U']);
    const analysis = analyzeCFOP(input)!;
    expect(analysis.crossColor).toBe('yellow');
    expect(analysis.phases.map(phase => phase.durationMs)).toEqual([0, 0, 0, 1200.125]);
    expect(analysis.states[0]).toBe(turn(SOLVED, 'U2'));
    expect(analyzeCFOP({ ...input, penalty: '+2' })).toEqual(analysis);
  });
  it('keeps Cross complete through F2L insertion and last-layer algorithms', () => {
    const input = result("R U R' R U R' U R U2 R' R U R' U' R' F R2 U' R' U' R U R' F' U".split(' '));
    const analysis = analyzeCFOP(input)!;
    expect(analysis.crossColor).toBe('yellow');
    expect(analysis.phases.map(phase => phase.endIndex)).toEqual([0, 3, 10, 25]);
    expect(analysis.phases.reduce((sum, phase) => sum + phase.durationMs, 0)).toBe(input.rawDurationMs);
  });
  it('preserves unsupported results without inventing details', () => {
    expect(analyzeCFOP(result(['R', 'U', 'F', 'L']))).toBeNull();
    expect(analyzeCFOP({ ...result(['U', 'U']), facelets: null })).toBeNull();
    const missingMove = result(['U', 'U']);
    missingMove.rawTurns![1].serial = 3;
    expect(analyzeCFOP(missingMove)).toBeNull();
  });
  it('accepts serial wrap and includes an authoritative stop after the last physical turn', () => {
    const input = result(['U', 'U']);
    input.rawTurns![0].serial = 255;
    input.rawTurns![1].serial = 0;
    input.rawDurationMs = 1300;
    expect(analyzeCFOP(input)!.phases[3].durationMs).toBe(1300);
  });
});

