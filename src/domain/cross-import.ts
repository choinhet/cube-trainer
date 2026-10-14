import { SOLVED, turn } from './cube';
import type { CrossCase, CrossColor } from './cross';

export function parseSharedScramble(text: string): { original: string; startingState: string } {
  const moves = text.trim().split(/\s+/);
  if (!text.trim() || moves.some(move => !/^[URFDLB](2|')?$/.test(move))) throw new Error("Use face turns such as R U2 F'. Rotations, wide turns, and slice moves are not supported.");
  if (moves.length > 500) throw new Error('A shared scramble can contain at most 500 moves');
  return { original: moves.join(' '), startingState: moves.reduce(turn, SOLVED) };
}

export function importedCrossCase(scramble: ReturnType<typeof parseSharedScramble>, color: CrossColor, optimum: number): CrossCase {
  if (optimum === 0) throw new Error('This scramble already solves the selected cross. Choose another color or scramble.');
  return { caseId: `cross-v1:${color}:${scramble.startingState}`, startingState: scramble.startingState, originalScramble: scramble.original, scrambleSource: SOLVED, color, optimum };
}
