import { expect, test } from 'vitest';
import { SOLVED, turn } from './cube';
import { CrossSolver, CROSS_MOVES, crossCoordinate, crossSuccessor, isCrossSolved, type CrossCase } from './cross';
import { CrossGuidance, countExecutedMoves } from './cross-guidance';
import { CrossAttempt } from './cross-attempt';

const solver = new CrossSolver('white');
function makeCase(scramble: string): CrossCase {
  const startingState = scramble.split(' ').reduce(turn, SOLVED);
  return { caseId: scramble, startingState, originalScramble: scramble, color: 'white', optimum: solver.distance(startingState) };
}
function guide(scramble: string) {
  const caseData = makeCase(scramble);
  return new CrossGuidance(caseData, solver.graph(caseData.startingState));
}
const event = (move: string, serial: number) => ({ move, serial, hostMs: serial * 100, deviceMs: null });

test('optimal graph retains every branch including paths converging at a shared node', () => {
  const caseData = makeCase('R L F2');
  const graph = solver.graph(caseData.startingState);
  const pending = [caseData.startingState];
  const visited = new Set<number>();
  while (pending.length) {
    const state = pending.pop()!;
    const code = crossCoordinate(state, 'white');
    if (visited.has(code)) continue;
    visited.add(code);
    expect(graph.nodes[code].edges.map(edge => edge.move)).toEqual(solver.query(state).nextMoves);
    for (const edge of graph.nodes[code].edges) {
      expect(edge.next).toBe(crossSuccessor(code, CROSS_MOVES.indexOf(edge.move)));
      expect(graph.nodes[edge.next].distance).toBe(graph.nodes[code].distance - 1);
      pending.push(turn(state, edge.move));
    }
  }
  expect(visited.size).toBe(Object.keys(graph.nodes).length);
});

test('accepts either commuting optimal route and switches displayed continuation', () => {
  const guidance = guide('R L');
  const initiallyShown = guidance.snapshot().sequence;
  const alternative = initiallyShown[0] === "R'" ? "L'" : "R'";
  guidance.receive(alternative);
  expect(guidance.snapshot()).toMatchObject({ status: 'training', completedMoves: [alternative], sequence: [alternative, initiallyShown[0]], mistakeEpisodes: 0 });
  guidance.receive(initiallyShown[0]);
  expect(guidance.snapshot()).toMatchObject({ status: 'completed', completedMoves: [alternative, initiallyShown[0]], mistakeEpisodes: 0 });
});

test.each(['R', "R'"])('split half turns stay provisional even when the quarter alone is wrong: %s', move => {
  const guidance = guide('R2');
  guidance.receive(move);
  expect(guidance.snapshot()).toMatchObject({ status: 'training', provisional: true, completedMoves: [], sequence: ['R2'], mistakeEpisodes: 0 });
  guidance.receive(move);
  expect(guidance.snapshot()).toMatchObject({ status: 'completed', provisional: false, completedMoves: ['R2'], mistakeEpisodes: 0 });
});

test('wrong activity during a provisional half turn must restore the exact anchor', () => {
  const guidance = guide('R2');
  guidance.receive('R'); guidance.receive('F');
  expect(guidance.snapshot()).toMatchObject({ status: 'correction', undo: ["F'", "R'"], completedMoves: [], mistakeEpisodes: 1 });
  guidance.receive('U');
  expect(guidance.snapshot().undo).toEqual(["U'", "F'", "R'"]);
  guidance.receive("U'"); guidance.receive("F'"); guidance.receive("R'");
  expect(guidance.snapshot()).toMatchObject({ status: 'training', undo: [], completedMoves: [], mistakeEpisodes: 1 });
  guidance.receive('R'); guidance.receive('R');
  expect(guidance.completed).toBe(true);
});

test('a mistake preserves an already valid quarter prefix and resumes its compatible route', () => {
  const guidance = guide('R L');
  guidance.receive("R'"); guidance.receive('F');
  expect(guidance.snapshot()).toMatchObject({ status: 'correction', completedMoves: ["R'"], undo: ["F'"] });
  guidance.receive("F'"); guidance.receive("L'");
  expect(guidance.snapshot()).toMatchObject({ status: 'completed', completedMoves: ["R'", "L'"], mistakeEpisodes: 1 });
});

test('undoing an invalid provisional turn restores the anchor without canceling executed activity', () => {
  const guidance = guide('R2');
  guidance.receive('R'); guidance.receive("R'");
  expect(guidance.snapshot()).toMatchObject({ status: 'training', completedMoves: [], mistakeEpisodes: 1 });
  expect(countExecutedMoves(['R', "R'"])).toBe(2);
});

test('guided completion cannot bypass correction merely because the cross is solved', () => {
  const caseData = makeCase('R L');
  const attempt = new CrossAttempt('attempt', 'session', caseData, 'semi-guided', solver.graph(caseData.startingState));
  attempt.arm();
  ['R', 'R', 'R', "L'"].forEach((move, i) => expect(attempt.receive(event(move, i + 1), 1000)).toBeNull());
  expect(isCrossSolved(attempt.facelets, 'white')).toBe(true);
  expect(attempt.guide?.status).toBe('correction');
  expect(attempt.reconcile(attempt.facelets, 450)).toBeNull();
  expect(attempt.phase).toBe('active');
  ['R', 'L'].forEach((move, i) => attempt.receive(event(move, i + 5), 1000));
  expect(attempt.guide?.status).toBe('training');
  attempt.receive(event("R'", 7), 1000);
  expect(attempt.receive(event("L'", 8), 1000)).toMatchObject({ status: 'completed', mode: 'semi-guided', mistakeEpisodes: 1, normalizedExecutedCount: 7, assisted: false });
});

test('fully guided is assisted immediately and unobserved state changes interrupt guided practice', () => {
  const caseData = makeCase('R2');
  const attempt = new CrossAttempt('attempt', 'session', caseData, 'fully-guided', solver.graph(caseData.startingState));
  attempt.arm();
  expect(attempt.checkpoint(0).record.assisted).toBe(true);
  expect(attempt.reconcile(turn(caseData.startingState, 'D'), 100)).toMatchObject({ status: 'interrupted', mode: 'fully-guided', assisted: true });
});

test('executed counting pairs quarters but retains inverse turns and extra revolutions', () => {
  expect(countExecutedMoves(['R', 'R', 'R', 'R'])).toBe(2);
  expect(countExecutedMoves(["R'", "R'", 'D', "D'", 'F2'])).toBe(4);
  expect(countExecutedMoves(['R', 'R2', 'R'])).toBe(3);
});

for (const mode of ['semi-guided', 'fully-guided'] as const) {
  test(`${mode} saves activity without recording elapsed time`, () => {
    const caseData = makeCase('R2');
    const attempt = new CrossAttempt('untimed', 'session', caseData, mode, solver.graph(caseData.startingState));
    attempt.arm();
    attempt.receive(event('R', 100), 1000);
    expect(attempt.elapsed(10000)).toBe(0);
    expect(attempt.receive(event('R', 2000), 3000)).toMatchObject({ status: 'completed', rawDurationMs: 0, normalizedExecutedCount: 1 });
  });
}
