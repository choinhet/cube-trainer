import { expect, test } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { CrossRepository } from './cross-repository';
import { CrossAttempt } from '../domain/cross-attempt';
import { SOLVED, turn } from '../domain/cube';
import type { LocalRepository } from './local-repository';

async function fixture(): Promise<Pick<LocalRepository, 'transaction'>> {
  const factory = new IDBFactory();
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open('cross-test', 1);
    request.onupgradeneeded = () => { for (const name of ['sessions', 'crossAttempts', 'crossCheckpoints', 'timedResults']) request.result.createObjectStore(name, { keyPath: 'id' }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const repository = { transaction: async <T,>(stores: string[], mode: IDBTransactionMode, work: (transaction: IDBTransaction) => () => T): Promise<T> => new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    const result = work(tx);
    tx.oncomplete = () => resolve(result());
    tx.onabort = () => reject(tx.error ?? new Error('aborted'));
  }) };
  await repository.transaction(['sessions'], 'readwrite', tx => { tx.objectStore('sessions').add({ id: 'session' }); return () => undefined; });
  return repository;
}
function attempt() { return new CrossAttempt('attempt', 'session', { caseId: 'r2', startingState: turn(SOLVED, 'R2'), originalScramble: 'R2', color: 'white', optimum: 1 }); }

test('cross checkpoints atomically recover into separate interrupted history exactly once', async () => {
  const local = await fixture();
  const repository = new CrossRepository(local);
  const active = attempt(); active.arm(); active.reveal();
  active.receive({ move: 'D', serial: 1, hostMs: 100, deviceMs: null }, 1000);
  await repository.saveCheckpoint(active.checkpoint(150));
  expect(await repository.recoverInterruptedAttempts()).toBe(1);
  expect(await repository.recoverInterruptedAttempts()).toBe(0);
  expect(await repository.list()).toMatchObject([{ status: 'interrupted', assisted: true, rawDurationMs: 50, case: active.caseData }]);
  const timed = await local.transaction(['timedResults'], 'readonly', tx => { const values = tx.objectStore('timedResults').getAll(); return () => values.result; });
  expect(timed).toEqual([]);
});

test('finalization is idempotent, deletes checkpoint, rejects missing sessions and updates reveal metadata', async () => {
  const local = await fixture(); const repository = new CrossRepository(local);
  const active = attempt(); active.arm();
  await repository.saveCheckpoint(active.checkpoint(10));
  const record = active.abandon(20)!;
  await repository.finalize(record); await repository.finalize(record);
  await repository.saveCheckpoint({ id: record.id, phase: 'ready', record });
  expect(await repository.recoverInterruptedAttempts()).toBe(0);
  await repository.markRevealed(record.id);
  expect(await repository.list()).toMatchObject([{ status: 'abandoned', assisted: true, revealed: true }]);
  await expect(repository.finalize({ ...record, status: 'completed' })).rejects.toThrow();
  await expect(repository.finalize({ ...record, id: 'missing', sessionId: 'missing' })).rejects.toThrow();
});
