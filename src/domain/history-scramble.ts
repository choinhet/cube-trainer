import { inverse, normalizeTurns } from './guidance';
import { SOLVED } from './cube';
import type { TimedResult } from './timed-attempt';

export function compactAlgorithm(moves: readonly string[]): string[] {
  let compact = [...moves];
  let previous: string;
  do { previous = compact.join(' '); compact = normalizeTurns(compact); } while (compact.join(' ') !== previous);
  return compact;
}

export function historyScramble(result: TimedResult): { moves: string[]; equivalent: boolean } | null {
  if (result.originalScramble) {
    const moves = result.originalScramble.trim().split(/\s+/);
    if (moves.every(move => /^[URFDLB](2|')?$/.test(move))) return { moves: compactAlgorithm(moves), equivalent: false };
  }
  if (result.status !== 'completed' || result.facelets !== SOLVED || !result.rawTurns?.length) return null;
  if (result.rawTurns.some((turn, i, all) => !/^[URFDLB](2|')?$/.test(turn.move) || (i > 0 && turn.serial !== (all[i - 1].serial + 1) % 256))) return null;
  return { moves: compactAlgorithm(result.rawTurns.map(turn => turn.move).reverse().map(inverse)), equivalent: true };
}
