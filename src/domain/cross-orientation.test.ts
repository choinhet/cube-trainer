import { expect, test } from 'vitest';
import { puzzles } from 'cubing/puzzles';
import { CROSS_COLORS, COLOR_FACE, type CrossColor } from './cross';
import { bottomCrossHolding, bottomCrossMove } from './cross-orientation';

test('bottom-cross notation is equivalent to independent whole-cube rotations for every face and direction', async () => {
  const puzzle = await puzzles['3x3x3'].kpuzzle();
  const rotations: Record<CrossColor, string> = { white: 'z2', yellow: '', red: 'z', orange: "z'", green: "x'", blue: 'x' };
  for (const color of CROSS_COLORS) {
    expect(bottomCrossMove(COLOR_FACE[color], color)).toBe('D');
    for (const face of 'URFDLB') {
      for (const suffix of ['', "'", '2']) {
        const move = face + suffix;
        const rotatedFirst = puzzle.defaultPattern().applyAlg(`R U F2 ${rotations[color]} ${bottomCrossMove(move, color)}`);
        const movedFirst = puzzle.defaultPattern().applyAlg(`R U F2 ${move} ${rotations[color]}`);
        expect(rotatedFirst.patternData, `${color} ${move}`).toEqual(movedFirst.patternData);
      }
    }
  }
  expect(bottomCrossHolding('white')).toBe('white on bottom, yellow on top, green in front');
});
