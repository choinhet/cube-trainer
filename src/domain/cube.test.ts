import { expect, it } from 'vitest';
import { FACES, SOLVED, isFacelets, isSolved, turn } from './cube';

it('matches a known R facelet permutation and a six-repeat identity algorithm', () => {
  expect(turn(SOLVED, 'R')).toBe('UUFUUFUUFRRRRRRRRRFFDFFDFFDDDBDDBDDBLLLLLLLLLUBBUBBUBB');
  let state = SOLVED;
  for (let repeat = 0; repeat < 6; repeat++) {
    for (const move of ['R', 'U', "R'", "U'"]) state = turn(state, move);
  }
  expect(state).toBe(SOLVED);
});
it.each([... 'URFDLB'])('restores state after inverse and four turns of %s', face => {
  const scrambled = turn(turn(SOLVED, 'R'), 'F');
  expect(turn(turn(scrambled, face), `${face}'`)).toBe(scrambled);
  expect(turn(turn(turn(turn(scrambled, face), face), face), face)).toBe(scrambled);
});
it('rejects impossible piece states and keeps a fixed center reference through legal turns', () => {
  const flipped = SOLVED.split('');
  [flipped[5], flipped[10]] = [flipped[10], flipped[5]];
  expect(isFacelets(flipped.join(''))).toBe(false);
  const twisted = SOLVED.split('');
  [twisted[8], twisted[9], twisted[20]] = [twisted[9], twisted[20], twisted[8]];
  expect(isFacelets(twisted.join(''))).toBe(false);
  const swapped = SOLVED.split('');
  [swapped[10], swapped[19]] = [swapped[19], swapped[10]];
  expect(isFacelets(swapped.join(''))).toBe(false);
  let state = SOLVED;
  for (const move of ['R', 'F2', "U'", 'L', 'B', 'D2']) {
    state = turn(state, move);
    expect(isFacelets(state)).toBe(true);
    expect([...FACES].map((_, i) => state[i * 9 + 4]).join('')).toBe(FACES);
    expect(isSolved(state)).toBe(false);
  }
  expect(isSolved(SOLVED)).toBe(true);
});

