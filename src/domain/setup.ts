import { isFacelets, SOLVED, turn } from './cube';

/** Timed scrambles and future cross cases share this full-state contract. */
export interface ExerciseTarget { original: string; target: string; source?: string; minimumSetupMoves?: number }
export interface ExerciseSetup { source: string; target: string; moves: string[] }
export type SetupSolver = (source: string, target: ExerciseTarget, signal: AbortSignal) => Promise<ExerciseSetup>;

export function validateTarget(target: ExerciseTarget): string[] {
  const moves = target.original.trim() ? target.original.trim().split(/\s+/) : [];
  if (!isFacelets(target.target) || !isFacelets(target.source ?? SOLVED) || moves.some(move => !/^[URFDLB](2|')?$/.test(move)) || moves.reduce(turn, target.source ?? SOLVED) !== target.target) throw new Error('Generated target does not match its scramble');
  return moves;
}
export function validateSetup(source: string, target: string, setup: ExerciseSetup): ExerciseSetup {
  if (!isFacelets(source) || !isFacelets(target) || setup.source !== source || setup.target !== target ||
    !Array.isArray(setup.moves) || setup.moves.some((move, i) => !/^[URFDLB](2|')?$/.test(move) || (i > 0 && setup.moves[i - 1][0] === move[0])) ||
    setup.moves.reduce(turn, source) !== target) throw new Error('Setup does not match its source and full target');
  return { source, target, moves: [...setup.moves] };
}

/** A repeat route has a minimum length; a cube already at the target needs no turns. */
export function withSetupMinimum(setup: ExerciseSetup, minimum = 0): ExerciseSetup {
  if (setup.source === setup.target) return { ...setup, moves: [] };
  if (setup.moves.length >= minimum) return setup;
  if (!Number.isInteger(minimum) || minimum < 0 || minimum > 15) throw new Error('Invalid setup minimum');
  // Each of these eight-turn sequences is an identity on the full cube.
  const identity = [['R2', 'L2', 'U2', 'D2'], ['U2', 'D2', 'F2', 'B2'], ['F2', 'B2', 'R2', 'L2']]
    .find(moves => moves.at(-1)![0] !== setup.moves[0]?.[0])!;
  let moves = [...setup.moves];
  while (moves.length < minimum) moves = [...identity, ...identity, ...moves];
  return validateSetup(setup.source, setup.target, { ...setup, moves });
}
