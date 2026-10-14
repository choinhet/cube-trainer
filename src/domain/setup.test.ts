import { expect, it } from 'vitest';
import { puzzles } from 'cubing/puzzles';
import { SOLVED, turn } from './cube';
import { computeSetup, patternFromFacelets } from './setup-solver';
import { validateScramble } from './scramble';
import { withSetupMinimum } from './setup';
import { Guidance } from './guidance';

it('maps arbitrary full facelet states to the independent solver piece model', async () => {
  const puzzle = await puzzles['3x3x3'].kpuzzle();
  for (const alg of ['', 'R', 'U', 'F', 'D', 'L', 'B', "R2 U F' L D2 B R' U2"]) {
    const facelets = alg ? alg.split(' ').reduce(turn, SOLVED) : SOLVED;
    expect((await patternFromFacelets(facelets)).patternData).toEqual(puzzle.defaultPattern().applyAlg(alg).patternData);
  }
  await expect(patternFromFacelets('invalid')).rejects.toThrow('valid');
});

it('solves arbitrary sources to the full target and uses the original directly from solved', async () => {
  const target = validateScramble('R2 U F');
  for (const alg of ['R U F2 D L B2', "B' D2 L F U2 R", 'R2 U F']) {
    const source = alg.split(' ').reduce(turn, SOLVED);
    const setup = await computeSetup(source, target);
    expect(setup.source).toBe(source);
    expect(setup.target).toBe(target.target);
    expect(setup.moves.reduce(turn, source)).toBe(target.target);
  }
  expect((await computeSetup(SOLVED, target)).moves).toEqual(target.moves);
}, 30_000);

it('returns to a full target whose original scramble starts from an unsolved cube', async () => {
  const scrambleSource = turn(SOLVED, 'D');
  const target = { original: 'R2', source: scrambleSource, target: turn(scrambleSource, 'R2') };
  for (const source of [SOLVED, turn(SOLVED, 'U'), scrambleSource, target.target]) {
    const setup = await computeSetup(source, target);
    expect(setup.moves.reduce(turn, source)).toBe(target.target);
  }
}, 30_000);

it('prepares a direct relative transformation between unrelated fully scrambled positions', async () => {
  const source = "R U2 F' L2 B D R2 F U' B2 L D' R U B' L2 F2 D R' U2".split(' ').reduce(turn, SOLVED);
  const original = "B2 U R' D2 F L' U2 B R2 D F2 L U' R B' D2 L2 F' U R2";
  const target = validateScramble(original);
  const setup = await computeSetup(source, { ...target, minimumSetupMoves: 15 });
  expect(setup.moves.reduce(turn, source)).toBe(target.target);
  expect(setup.moves.length).toBeGreaterThanOrEqual(15);
  expect(setup.moves.length).toBeLessThanOrEqual(25);
}, 30_000);

it('pads short retry routes to 15–25 moves without changing the target or arming early', () => {
  for (let length = 1; length < 15; length++) {
    for (const face of 'URFDLB') {
      const moves = Array.from({ length }, (_, index) => index % 2 ? (face === 'U' ? 'F' : 'U') : face);
      const target = moves.reduce(turn, SOLVED);
      const setup = withSetupMinimum({ source: SOLVED, target, moves }, 15);
      if (target === SOLVED) { expect(setup.moves).toEqual([]); continue; }
      expect(setup.moves.length).toBeGreaterThanOrEqual(15);
      expect(setup.moves.length).toBeLessThanOrEqual(25);
      expect(setup.moves.reduce(turn, SOLVED)).toBe(target);
      const guide = new Guidance(SOLVED, setup.moves);
      setup.moves.forEach((move, index) => {
        guide.receive({ move, serial: index, hostMs: index, deviceMs: null });
        expect(guide.snapshot().status).toBe(index === setup.moves.length - 1 ? 'ready' : 'preparing');
      });
    }
  }
  expect(withSetupMinimum({ source: SOLVED, target: SOLVED, moves: [] }, 15).moves).toEqual([]);
});
