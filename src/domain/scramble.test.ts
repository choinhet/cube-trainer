import { expect, it } from 'vitest';
import { validateScramble } from './scramble';
import { SOLVED, turn } from './cube';

it('validates outer-face practice notation and the exact full target', () => {
  expect(validateScramble('R2 U F\'')).toEqual({ original: "R2 U F'", moves: ['R2', 'U', "F'"], target: ['R2', 'U', "F'"].reduce(turn, SOLVED) });
  for (const invalid of ['', 'U4', 'D4', 'Rw', 'x', 'R R', 'U (R)']) expect(() => validateScramble(invalid)).toThrow();
});
