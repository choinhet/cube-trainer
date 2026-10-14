import { expect, test } from 'vitest';
import { importedCrossCase, parseSharedScramble } from './cross-import';
import { SOLVED, turn } from './cube';

test('imports normalized notation from solved and preserves the full target', () => {
  const parsed = parseSharedScramble(" R  U2\n F' ");
  expect(parsed.original).toBe("R U2 F'");
  expect(parsed.startingState).toBe(['R', 'U2', "F'"].reduce(turn, SOLVED));
  expect(importedCrossCase(parsed, 'white', 3)).toMatchObject({ scrambleSource: SOLVED, startingState: parsed.startingState, color: 'white', optimum: 3 });
});

test.each(['', 'x R', 'Rw U', 'M', 'R3', "R2'", 'some text'])('rejects invalid shared notation: %s', text => {
  expect(() => parseSharedScramble(text)).toThrow('Use face turns');
});

test('rejects cases with a solved selected cross', () => {
  expect(() => importedCrossCase(parseSharedScramble('D'), 'white', 0)).toThrow('already solves');
});
