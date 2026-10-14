// @vitest-environment node
import { expect, test } from 'vitest';
import { SOLVED, turn } from './cube';
import { CrossSolver, CROSS_COLORS, CROSS_EDGES, isCrossSolved } from './cross';

test('cross needs adjacent center alignment as well as color stickers', () => {
  expect(isCrossSolved(SOLVED, 'white')).toBe(true);
  expect(isCrossSolved(turn(SOLVED, 'U'), 'white')).toBe(false);
});

test('exact distance table preserves every optimal branch', () => {
  const solver = new CrossSolver('white');
  expect(solver.distance(SOLVED)).toBe(0);
  const state = turn(turn(SOLVED, 'R'), 'L');
  expect(solver.query(state).nextMoves.sort()).toEqual(["L'", "R'"]);
  for (const move of solver.query(state).nextMoves) {
    expect(solver.query(turn(state, move)).distance).toBe(1);
  }
  for (const difficulty of [1,2,3,4,5,6,7,8]) {
    const generated = solver.generate(difficulty);
    expect(generated.originalScramble.split(' ').reduce(turn, SOLVED)).toBe(generated.startingState);
    expect(solver.distance(generated.startingState)).toBe(difficulty);
    expect(generated.originalScramble.split(' ').length).toBeGreaterThanOrEqual(18);
    expect(generated.originalScramble.split(' ').length).toBeLessThanOrEqual(25);
    expect(generated.originalScramble.split(' ').length).toBeGreaterThan(difficulty);
    const corners = [[8,9,20],[2,45,11],[0,36,47],[6,18,38],[29,26,15],[27,44,24],[33,53,42],[35,17,51]];
    expect(corners.every(piece => piece.some(index => generated.startingState[index] !== SOLVED[index]))).toBe(true);
    const nonCrossEdges = CROSS_EDGES.filter(piece => !piece.some(index => SOLVED[index] === 'U'));
    expect(nonCrossEdges.every(piece => piece.some(index => generated.startingState[index] !== SOLVED[index]))).toBe(true);
    // A completed cross can leave the rest of the cube scrambled.
    const source = turn(SOLVED, 'D');
    const next = solver.generate(difficulty, source);
    expect(next.originalScramble.split(' ').reduce(turn, source)).toBe(next.startingState);
    expect(solver.distance(next.startingState)).toBe(difficulty);
    expect(next.originalScramble.split(' ').length).toBeGreaterThan(difficulty);
    expect(next.originalScramble.split(' ').length).toBeLessThanOrEqual(25);
  }
  const source = ['R', 'F', 'L2', 'B', 'U'].reduce(turn, SOLVED);
  const generated = solver.generate(3, source);
  expect(generated.originalScramble.split(' ').length).toBeLessThanOrEqual(25);
  expect(generated.originalScramble.split(' ').reduce(turn, source)).toBe(generated.startingState);
  expect(solver.distance(generated.startingState)).toBe(3);
  expect(CROSS_COLORS).toHaveLength(6);
}, 120_000);
