import { expect, test } from 'vitest';
import { CrossAttempt, recoverCrossCheckpoint } from './cross-attempt';
import { SOLVED, turn } from './cube';
import { CrossSolver, type CrossCase } from './cross';

const caseData: CrossCase = { caseId: 'case-r2', startingState: turn(SOLVED, 'R2'), originalScramble: 'R2', color: 'white', optimum: 1 };
const event = (move: string, hostMs: number, serial = 1) => ({ move, hostMs, serial, deviceMs: null });

test('free cross accepts nonoptimal play, raw identity activity, split half turns and stops once', () => {
  const attempt = new CrossAttempt('attempt', 'session', caseData);
  expect(attempt.receive(event('R', 10), 100)).toBeNull(); // still setup
  attempt.arm();
  expect(attempt.receive(event('D', 100), 1000)).toBeNull();
  expect(attempt.receive(event("D'", 200, 2), 2000)).toBeNull();
  expect(attempt.receive(event('R', 500, 3), 9000)).toBeNull();
  const result = attempt.receive(event('R', 10000, 4), -1);
  expect(result).toMatchObject({ status: 'completed', sessionId: 'session', mode: 'free', case: caseData, startedAt: 1000, rawDurationMs: 9900, normalizedExecutedCount: 3, mistakeEpisodes: 0, revealed: false, assisted: false });
  expect(result!.rawTrace.map(value => value.move)).toEqual(['D', "D'", 'R', 'R']);
  expect(attempt.receive(event('R', 20000, 5), 0)).toBeNull();
});

test('manual net-identity cancellation is abandoned and technical interruption is distinct', () => {
  const attempt = new CrossAttempt('abandoned', 'session', caseData); attempt.arm();
  attempt.receive(event('D', 10), 100);
  attempt.receive(event("D'", 20, 2), 200);
  expect(attempt.abandon(30)).toMatchObject({ status: 'abandoned', rawDurationMs: 20, normalizedExecutedCount: 2, rawTrace: [event('D', 10), event("D'", 20, 2)] });
  expect(attempt.interrupt(40, 'Disconnected')).toBeNull();
  const interrupted = new CrossAttempt('interrupted', 'session', caseData); interrupted.arm();
  expect(interrupted.interrupt(40, 'Disconnected')).toMatchObject({ status: 'interrupted', reason: 'Disconnected', startedAt: null, rawDurationMs: 0 });
});

test('reveals remain assisted in checkpoints, recovery and completed metadata', () => {
  const attempt = new CrossAttempt('reveal', 'session', caseData); attempt.arm();
  attempt.reveal();
  attempt.receive(event('R', 10), 100);
  const checkpoint = attempt.checkpoint(35);
  expect(recoverCrossCheckpoint(checkpoint)).toMatchObject({ status: 'interrupted', reason: 'Browser reopened with unfinished cross practice', revealed: true, assisted: true, rawDurationMs: 25, rawTrace: [event('R', 10)] });
  const result = attempt.receive(event('R', 50, 2), 200)!;
  expect(result.assisted).toBe(true);
  expect(attempt.reveal()).toMatchObject({ id: 'reveal', revealed: true, assisted: true });
});

test('executed counting retains intervening inverse turns', () => {
  const attempt = new CrossAttempt('runs', 'session', { ...caseData, startingState: turn(SOLVED, 'F2'), originalScramble: 'F2' }); attempt.arm();
  ['R', 'D', "D'", "R'"].forEach((move, i) => attempt.receive(event(move, i, i), 100));
  expect(attempt.checkpoint(5).record.normalizedExecutedCount).toBe(4);
});

test('known-case setup interruption retains preparation state while manual setup cancellation has no record', () => {
  const attempt = new CrossAttempt('setup', 'session', caseData);
  attempt.setPreparationState(SOLVED);
  expect(attempt.checkpoint(50)).toMatchObject({ phase: 'setup', record: { lastState: SOLVED, rawTrace: [], rawDurationMs: 0 } });
  expect(attempt.interrupt(100, 'Disconnected')).toMatchObject({ status: 'interrupted', lastState: SOLVED, startedAt: null });
  const cancelled = new CrossAttempt('cancelled', 'session', caseData);
  expect(cancelled.abandon(100)).toBeNull();
});

test('mode switching replays free exploration, retains correction and first-turn timing, and records sticky assistance', () => {
  const solver = new CrossSolver('white');
  const graph = solver.graph(caseData.startingState);
  const attempt = new CrossAttempt('mixed', 'session', caseData);
  attempt.arm(); attempt.receive(event('F', 100), 1000);
  attempt.switchMode('fully-guided', 200, graph);
  expect(attempt.guide?.status).toBe('correction');
  expect(attempt.guide?.undo).toEqual(["F'"]);
  expect(attempt.isAssisted).toBe(true);
  attempt.switchMode('free', 300);
  expect(attempt.guide).toBeNull();
  expect(attempt.receive(event("F'", 400, 2), 2000)).toBeNull();
  attempt.switchMode('semi-guided', 500);
  expect(attempt.guide?.status).toBe('training');
  attempt.receive(event('R', 600, 3), 3000);
  const result = attempt.receive(event('R', 800, 4), 4000)!;
  expect(result).toMatchObject({ id: 'mixed', mode: 'mixed', case: caseData, rawDurationMs: 700, normalizedExecutedCount: 3, assisted: true, mistakeEpisodes: 1 });
  expect(result.modeChanges).toEqual([
    { mode: 'free', atMoveIndex: 0, elapsedMs: 0 },
    { mode: 'fully-guided', atMoveIndex: 1, elapsedMs: 100 },
    { mode: 'free', atMoveIndex: 1, elapsedMs: 200 },
    { mode: 'semi-guided', atMoveIndex: 2, elapsedMs: 400 },
  ]);
});

test('switching to Free during correction accepts a solved cross and preserves the attempt', () => {
  const solver = new CrossSolver('white');
  const attempt = new CrossAttempt('leave-guided', 'session', caseData, 'semi-guided', solver.graph(caseData.startingState));
  attempt.arm(); attempt.receive(event('D', 100), 1000);
  expect(attempt.guide?.status).toBe('correction');
  attempt.switchMode('free', 200);
  attempt.receive(event("D'", 300, 2), 2000);
  const result = attempt.receive(event('R2', 400, 3), 3000)!;
  expect(result).toMatchObject({ id: 'leave-guided', mode: 'mixed', rawDurationMs: 300, assisted: false, normalizedExecutedCount: 3 });
});
