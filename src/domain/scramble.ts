import { SOLVED, isFacelets, turn } from './cube';
export interface PracticeScramble { original: string; moves: string[]; target: string }
export function validateScramble(original: string): PracticeScramble {
  const moves = original.trim().split(/\s+/);
  if (!moves.length || moves.some((move, i) => !/^[URFDLB](2|')?$/.test(move) || (i > 0 && moves[i - 1][0] === move[0]))) throw new Error('Invalid practice scramble notation');
  const target = moves.reduce(turn, SOLVED);
  if (!isFacelets(target) || target === SOLVED) throw new Error('Invalid practice scramble target');
  return { original: moves.join(' '), moves, target };
}
