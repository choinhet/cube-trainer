import { expect, test, vi } from 'vitest';
import { CrossFlow } from './cross-flow';
import { SOLVED, turn } from './cube';
import type { CrossCase } from './cross';
const caseData: CrossCase = { caseId: 'r2', startingState: turn(SOLVED, 'R2'), originalScramble: 'R2', color: 'white', optimum: 1 };
const persistence = () => ({ saveCheckpoint: vi.fn(async () => {}), finalize: vi.fn(async () => {}), markRevealed: vi.fn(async () => {}), clearCheckpoint: vi.fn(async () => {}) });

test('serializes checkpoints before exactly one completion and late reveal metadata', async () => {
  const store = persistence();
  const flow = new CrossFlow('attempt', 'session', caseData, store, () => {}, () => 100);
  flow.arm();
  flow.receive({ move: 'R', serial: 1, hostMs: 100, deviceMs: null }, 1000);
  flow.receive({ move: 'R', serial: 2, hostMs: 200, deviceMs: null }, 2000);
  flow.receive({ move: 'R', serial: 3, hostMs: 300, deviceMs: null }, 3000);
  await flow.settled();
  expect(store.finalize).toHaveBeenCalledOnce();
  expect(store.saveCheckpoint).toHaveBeenCalledTimes(2);
  expect(flow.snapshot().saveState).toBe('saved');
  await flow.reveal(async () => ['R2']);
  expect(store.markRevealed).toHaveBeenCalledWith('attempt');
  expect(flow.snapshot().result).toMatchObject({ assisted: true });
  expect(flow.snapshot().solution).toEqual(['R2']);
});

test('save errors stay visible and retry uses the same result without duplicating completion', async () => {
  const store = persistence(); store.finalize.mockRejectedValueOnce(new Error('Quota exceeded'));
  const flow = new CrossFlow('attempt', 'session', caseData, store, () => {}, () => 200);
  flow.arm(); flow.abandon();
  await flow.settled();
  expect(flow.snapshot()).toMatchObject({ saveState: 'failed', error: 'Error: Quota exceeded', result: { status: 'abandoned' } });
  flow.retrySave(); await flow.settled();
  expect(store.finalize.mock.calls[0]).toEqual(store.finalize.mock.calls[1]);
  expect(flow.snapshot().saveState).toBe('saved');
});

test('failed reveal metadata retries the metadata operation instead of silently losing assistance', async () => {
  const store = persistence(); store.markRevealed.mockRejectedValueOnce(new Error('metadata write failed'));
  const flow = new CrossFlow('attempt', 'session', caseData, store, () => {}, () => 200);
  flow.arm(); flow.abandon(); await flow.settled();
  await flow.reveal(async () => ['R2']);
  expect(flow.snapshot().saveState).toBe('failed');
  flow.retrySave(); await flow.settled();
  expect(store.markRevealed).toHaveBeenCalledTimes(2);
  expect(flow.snapshot().saveState).toBe('saved');
});

test('checkpoint failure preserves the attempt and completion remains saveable', async () => {
  const store = persistence(); store.saveCheckpoint.mockRejectedValueOnce(new Error('checkpoint failed'));
  const flow = new CrossFlow('attempt', 'session', caseData, store, () => {}, () => 200);
  flow.arm(); await flow.settled(); await flow.settled();
  expect(flow.snapshot()).toMatchObject({ phase: 'ready', result: null });
  expect(flow.snapshot().error).toContain('checkpoint');
  expect(store.finalize).not.toHaveBeenCalled();
  flow.receive({ move: 'R', serial: 1, hostMs: 100, deviceMs: null, recovered: true }, 1000);
  flow.receive({ move: 'R', serial: 2, hostMs: 200, deviceMs: null }, 2000);
  await flow.settled();
  expect(flow.snapshot().result?.status).toBe('completed');
  expect(store.finalize).toHaveBeenCalledOnce();
});

test('manual setup cancellation clears its checkpoint durably without a result and retries cleanup failure', async () => {
  const store = persistence(); store.clearCheckpoint.mockRejectedValueOnce(new Error('cleanup failed'));
  const flow = new CrossFlow('attempt', 'session', caseData, store, () => {}, () => 200);
  flow.preparation(SOLVED);
  await flow.cancelSetup();
  expect(flow.snapshot()).toMatchObject({ phase: 'finished', result: null, saveState: 'failed' });
  flow.retrySave(); await flow.settled();
  expect(store.clearCheckpoint).toHaveBeenCalledTimes(2);
  expect(store.finalize).not.toHaveBeenCalled();
  expect(flow.snapshot().saveState).toBe('saved');
});
