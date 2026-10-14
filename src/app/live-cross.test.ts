import { afterEach, expect, test, vi } from 'vitest';
import { LiveSession } from './live-session';
import { SOLVED, turn } from '../domain/cube';
import type { GanCubeEvent } from 'gan-web-bluetooth';
import type { Connection } from '../domain/session';
import { CrossSolver, type CrossCase } from '../domain/cross';
import { CrossClient } from '../workers/cross-client';

afterEach(() => vi.restoreAllMocks());

const caseData: CrossCase = { caseId: 'r2', startingState: turn(SOLVED, 'R2'), originalScramble: 'R2', color: 'white', optimum: 1 };
async function fixture(source = SOLVED) {
  let next: (event: GanCubeEvent) => void = () => {};
  let clock = 0; let wall = 1000; let serial = 10;
  const store = { saveCheckpoint: vi.fn(async () => {}), finalize: vi.fn(async () => {}), markRevealed: vi.fn(async () => {}), clearCheckpoint: vi.fn(async () => {}) };
  const connection: Connection = { deviceName: 'test', events$: { subscribe: observer => { next = observer.next; return { unsubscribe: () => {} }; } }, sendCubeCommand: async () => {}, disconnect: async () => {} };
  const session = new LiveSession(async () => connection, () => clock, () => {}, () => wall);
  await session.connect();
  next({ type: 'FACELETS', timestamp: 0, serial, facelets: source, state: { CP: [], CO: [], EP: [], EO: [] } });
  return { session, store, move: (move: string, hostMs: number) => { clock = hostMs; wall += 10; next({ type: 'MOVE', timestamp: hostMs, localTimestamp: hostMs, cubeTimestamp: null, serial: ++serial, move, face: 'URFDLB'.indexOf(move[0]), direction: move.endsWith("'") ? 1 : 0 }); }, emit: (event: GanCubeEvent) => next(event) };
}
test('exact setup arms free cross without consuming preparation events, then accepts nonoptimal moves', async () => {
  const { session, store, move } = await fixture();
  await session.startCrossPreparation('session', 'white', 1, store, async () => caseData);
  move('R', 10); move('R', 10000);
  expect(session.cross?.phase).toBe('ready');
  expect(session.cross?.normalizedExecutedCount).toBe(0);
  move('D', 20000); move("D'", 20100); move('R', 21000); move('R', 22000);
  await vi.waitFor(() => expect(store.finalize).toHaveBeenCalledOnce());
  expect(session.cross?.result).toMatchObject({ status: 'completed', rawDurationMs: 2000, normalizedExecutedCount: 3, rawTrace: [{ move: 'D' }, { move: "D'" }, { move: 'R' }, { move: 'R' }] });
  expect(session.timed).toBeNull();
  session.cancelCrossPractice(); await session.disconnect();
});

test('ready cross survives disconnect and resumes after automatic synchronization', async () => {
  const { session, store, move, emit } = await fixture(caseData.startingState);
  await session.startCrossPreparation('session', 'white', 1, store, async () => caseData);
  await session.disconnect();
  expect(store.finalize).not.toHaveBeenCalled();
  expect(session.cross?.phase).toBe('ready');
  await session.connect();
  emit({ type: 'FACELETS', timestamp: 0, serial: 10, facelets: caseData.startingState, state: { CP: [], CO: [], EP: [], EO: [] } });
  move('R', 100); move('R', 200);
  await vi.waitFor(() => expect(store.finalize).toHaveBeenCalledOnce());
  expect(session.cross?.result?.status).toBe('completed');
});

test('a reported full-state mismatch preserves timing until the authoritative cross is solved', async () => {
  const { session, store, move, emit } = await fixture(caseData.startingState);
  await session.startCrossPreparation('session', 'white', 1, store, async () => caseData);
  move('R', 100);
  emit({ type: 'FACELETS', timestamp: 0, serial: 11, facelets: turn(SOLVED, 'F'), state: { CP: [], CO: [], EP: [], EO: [] } });
  expect(store.finalize).not.toHaveBeenCalled();
  expect(session.cross?.phase).toBe('active');
  move("F'", 200);
  await vi.waitFor(() => expect(store.finalize).toHaveBeenCalledOnce());
  expect(session.cross?.result).toMatchObject({ status: 'completed', rawDurationMs: 100 });
});

test('arbitrary-state cross setup uses full-target solver and gyro never starts timing', async () => {
  const source = turn(SOLVED, 'F');
  const { session, store, move, emit } = await fixture(source);
  const solve = vi.fn(async () => ({ source, target: caseData.startingState, moves: ["F'", 'R2'] }));
  await session.startCrossPreparation('session', 'white', 1, store, async () => caseData, solve);
  expect(solve).toHaveBeenCalledWith(source, { original: 'R2', target: caseData.startingState }, expect.any(AbortSignal));
  move("F'", 10); move('R', 20); move('R', 30);
  emit({ type: 'GYRO', timestamp: 99, quaternion: { x: 0, y: 0, z: 0, w: 1 } });
  expect(session.cross).toMatchObject({ phase: 'ready', normalizedExecutedCount: 0, elapsedMs: 0 });
  move('R', 100); move('R', 200);
  await vi.waitFor(() => expect(store.finalize).toHaveBeenCalledOnce());
  expect(session.cross?.result).toMatchObject({ rawDurationMs: 100, normalizedExecutedCount: 1, rawTrace: [{ move: 'R' }, { move: 'R' }] });
  await session.disconnect();
});

test('a prefetched cross case is rebound to the completed cross without a full-cube solve', async () => {
  const source = turn(SOLVED, 'D');
  const { session, store, move } = await fixture(source);
  const solve = vi.fn();
  const generated = { ...caseData, scrambleSource: SOLVED };
  await session.startCrossPreparation('session', 'white', 1, store, async () => generated, solve);
  expect(solve).not.toHaveBeenCalled();
  expect(session.preparation?.guide?.sequence).toEqual(['R2']);
  expect(session.cross?.case.scrambleSource).toBe(source);
  expect(session.cross?.case.startingState).toBe(turn(source, 'R2'));
  move('R', 10); move('R', 20);
  expect(session.cross?.phase).toBe('ready');
  move('R', 100); move('R', 200);
  await vi.waitFor(() => expect(store.finalize).toHaveBeenCalledOnce());
  expect(session.cross?.result?.status).toBe('completed');
  expect(session.diagnostic.snapshot().facelets).toBe(source);
  await session.disconnect();
});

test('missing sessions and generation mismatches never silently start another case', async () => {
  const { session, store } = await fixture();
  const generate = vi.fn(async () => caseData);
  await expect(session.startCrossPreparation('', 'white', 1, store, generate)).rejects.toThrow('session');
  expect(generate).not.toHaveBeenCalled();
  await session.startCrossPreparation('session', 'white', 8, store, generate);
  expect(session.preparation?.error).toContain('requested color and exact difficulty');
  expect(session.cross).toBeNull();
  session.cancelCrossPractice(); await session.disconnect();
});

test('known-case setup interruption retains case but excludes all preparation activity from attempt metrics', async () => {
  const { session, store, move } = await fixture();
  await session.startCrossPreparation('session', 'white', 1, store, async () => caseData);
  move('R', 100);
  await session.disconnect();
  await vi.waitFor(() => expect(store.finalize).toHaveBeenCalledOnce());
  expect(session.cross?.result).toMatchObject({ status: 'interrupted', case: caseData, startedAt: null, rawDurationMs: 0, rawTrace: [], lastState: turn(SOLVED, 'R') });
});

test('manual setup cancellation creates no attempt and failed cleanup can retry before new practice', async () => {
  const { session, store } = await fixture();
  store.clearCheckpoint.mockRejectedValueOnce(new Error('cleanup failed'));
  await session.startCrossPreparation('session', 'white', 1, store, async () => caseData);
  session.cancelCrossPractice();
  await vi.waitFor(() => expect(session.cross?.saveState).toBe('failed'));
  expect(store.finalize).not.toHaveBeenCalled();
  await expect(session.startCrossPreparation('session', 'white', 1, store, async () => caseData)).rejects.toThrow('clear');
  session.retryCrossSave();
  await vi.waitFor(() => expect(session.cross).toBeNull());
  expect(store.clearCheckpoint).toHaveBeenCalledTimes(2);
  expect(store.finalize).not.toHaveBeenCalled();
  await session.disconnect();
});

test('guided live turns expose correction, ignore regrips, and persist the selected mode', async () => {
  const solver = new CrossSolver('white');
  vi.spyOn(CrossClient.prototype, 'graph').mockImplementation(async (_color, state) => solver.graph(state));
  const { session, store, move, emit } = await fixture(caseData.startingState);
  await session.startCrossPreparation('session', 'white', 1, store, async () => caseData, undefined, { mode: 'fully-guided' });
  emit({ type: 'GYRO', timestamp: 0, quaternion: { x: 1, y: 0, z: 0, w: 0 } });
  expect(session.cross).toMatchObject({ mode: 'fully-guided', phase: 'ready', normalizedExecutedCount: 0 });
  move('F', 100);
  expect(session.activity).toBe('correction');
  expect(session.cross?.guidance?.undo).toEqual(["F'"]);
  move("F'", 200);
  expect(session.activity).toBe('cross-attempt');
  move('R', 300);
  expect(session.cross?.guidance).toMatchObject({ provisional: true, mistakeEpisodes: 1 });
  emit({ type: 'GYRO', timestamp: 0, quaternion: { x: 0, y: 1, z: 0, w: 0 } });
  move('R', 500);
  await vi.waitFor(() => expect(store.finalize).toHaveBeenCalledOnce());
  expect(session.cross?.result).toMatchObject({ mode: 'fully-guided', status: 'completed', normalizedExecutedCount: 3, mistakeEpisodes: 1, assisted: true });
  await session.disconnect();
});

test('repeat skips case rebinding and prepares the original full state even after non-cross pieces change', async () => {
  const { session, store, move } = await fixture();
  const original = { ...caseData, scrambleSource: SOLVED };
  await session.startCrossPreparation('session', 'white', 1, store, async () => original);
  move('R', 10); move('R', 20);
  move('R', 100); move('R', 200); move('D', 300);
  await vi.waitFor(() => expect(session.cross?.saveState).toBe('saved'));
  const firstId = session.cross?.result?.id;
  session.cancelCrossPractice();
  const source = turn(SOLVED, 'D');
  const solve = vi.fn(async () => ({ source, target: original.startingState, moves: ["D'", 'R2'] }));
  await session.startCrossPreparation('session', 'white', 1, store, async () => original, solve, { repeat: true });
  expect(solve).toHaveBeenCalledWith(source, { original: 'R2', target: original.startingState, source: SOLVED, minimumSetupMoves: 15 }, expect.any(AbortSignal));
  expect(session.cross?.case).toEqual(original);
  const sequence = session.preparation!.guide!.sequence;
  expect(sequence.length).toBeGreaterThanOrEqual(15);
  expect(sequence.length).toBeLessThanOrEqual(25);
  let setupMs = 400;
  for (const notation of sequence) { move(notation.endsWith('2') ? notation[0] : notation, setupMs += 10); if (notation.endsWith('2')) move(notation[0], setupMs += 10); }
  expect(session.diagnostic.snapshot().facelets).toBe(original.startingState);
  move('R', 1000); move('R', 1100);
  await vi.waitFor(() => expect(store.finalize).toHaveBeenCalledTimes(2));
  expect(session.cross?.result?.id).not.toBe(firstId);
  expect(session.cross?.result?.case).toEqual(original);
  await session.disconnect();
});

test('repeat retains an unsolved scramble source when requesting setup from the current state', async () => {
  const originalSource = turn(SOLVED, 'D');
  const original = { ...caseData, startingState: turn(originalSource, 'R2'), scrambleSource: originalSource };
  const { session, store, move } = await fixture(originalSource);
  await session.startCrossPreparation('session', 'white', 1, store, async () => original);
  move('R', 10); move('R', 20);
  move('R', 100); move('R', 200); move('D', 300);
  await vi.waitFor(() => expect(session.cross?.saveState).toBe('saved'));
  session.cancelCrossPractice();
  const source = turn(originalSource, 'D');
  const solve = vi.fn(async () => ({ source, target: original.startingState, moves: ["D'", 'R2'] }));
  await session.startCrossPreparation('session', 'white', 1, store, async () => original, solve, { repeat: true });
  expect(solve).toHaveBeenCalledWith(source, { original: 'R2', target: original.startingState, source: originalSource, minimumSetupMoves: 15 }, expect.any(AbortSignal));
  const sequence = session.preparation!.guide!.sequence;
  expect(sequence.length).toBeGreaterThanOrEqual(15);
  expect(sequence.length).toBeLessThanOrEqual(25);
  let setupMs = 400;
  for (const notation of sequence) { move(notation.endsWith('2') ? notation[0] : notation, setupMs += 10); if (notation.endsWith('2')) move(notation[0], setupMs += 10); }
  expect(session.cross?.phase).toBe('ready');
  expect(session.diagnostic.snapshot().facelets).toBe(original.startingState);
  await session.disconnect();
});

test('import preserves the solved-origin full target instead of rebinding it to the current scrambled cube', async () => {
  const source = turn(SOLVED, 'D');
  const { session, store, move } = await fixture(source);
  const imported = { ...caseData, scrambleSource: SOLVED };
  const solve = vi.fn(async () => ({ source, target: imported.startingState, moves: ["D'", 'R2'] }));
  await session.startCrossPreparation('session', 'white', 1, store, async () => imported, solve, { imported: true });
  expect(session.cross?.case).toEqual(imported);
  expect(solve).toHaveBeenCalledWith(source, { original: 'R2', target: imported.startingState, source: SOLVED }, expect.any(AbortSignal));
  move("D'", 10); move('R', 20); move('R', 30);
  expect(session.cross?.phase).toBe('ready');
  expect(session.diagnostic.snapshot().facelets).toBe(imported.startingState);
});

test('mode switching safely includes physical turns arriving while the original optimal graph is queried', async () => {
  const { session, store, move } = await fixture(caseData.startingState);
  await session.startCrossPreparation('session', 'white', 1, store, async () => caseData);
  move('F', 100);
  let finishGraph!: (graph: ReturnType<CrossSolver['graph']>) => void;
  vi.spyOn(CrossClient.prototype, 'graph').mockImplementation(() => new Promise(resolve => { finishGraph = resolve; }));
  const switching = session.switchCrossMode('fully-guided');
  move('D', 200);
  finishGraph(new CrossSolver('white').graph(caseData.startingState));
  await switching;
  expect(session.cross?.mode).toBe('fully-guided');
  expect(session.cross?.guidance?.undo).toEqual(["D'", "F'"]);
  expect(session.cross?.normalizedExecutedCount).toBe(2);
  expect(session.cross?.elapsedMs).toBe(100);
  expect(store.finalize).not.toHaveBeenCalled();
});
