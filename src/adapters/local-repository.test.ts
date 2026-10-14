import { IDBFactory } from 'fake-indexeddb';
import { expect, it } from 'vitest';
import { LocalRepository } from './local-repository';

it('starts empty and atomically creates and selects an explicit session across reopening', async () => {
  const factory = new IDBFactory();
  const repository = new LocalRepository(factory);
  expect(await repository.load()).toEqual({ sessions: [], currentSessionId: null, settings: { reportingTimezone: 'America/Sao_Paulo', mirroredCrossInstructions: true } });
  const session = await repository.createSession(' Evening ', 1234);
  expect(session).toEqual({ id: expect.any(String), name: 'Evening', createdAt: 1234 });
  const reopened = new LocalRepository(factory);
  expect(await reopened.load()).toEqual({ sessions: [session], currentSessionId: session.id, settings: { reportingTimezone: 'America/Sao_Paulo', mirroredCrossInstructions: true } });
  repository.close(); reopened.close();
});

it('selects existing sessions explicitly and restores a validated timezone independently of system defaults', async () => {
  const factory = new IDBFactory();
  const repository = new LocalRepository(factory);
  const first = await repository.createSession('First');
  const second = await repository.createSession('Second');
  await repository.selectSession(first.id);
  await repository.saveSettings({ reportingTimezone: 'Europe/London' });
  await expect(repository.selectSession('missing')).rejects.toThrow('does not exist');
  await expect(repository.saveSettings({ reportingTimezone: 'not/a-zone' })).rejects.toThrow('IANA');
  const reopened = new LocalRepository(factory);
  expect(await reopened.load()).toMatchObject({ currentSessionId: first.id, sessions: expect.arrayContaining([first, second]), settings: { reportingTimezone: 'Europe/London' } });
  repository.close(); reopened.close();
});

it('saves completed raw precision once and restores results across reopening', async () => {
  const factory = new IDBFactory(); const repository = new LocalRepository(factory);
  const session = await repository.createSession('Timed');
  const result = { id: 'attempt', sessionId: session.id, status: 'completed' as const, startedAt: 100, rawDurationMs: 1234.567, penalty: '+2' as const, timingBasis: 'host-monotonic-receipt' as const };
  await repository.saveTimedResult(result);
  await expect(repository.saveTimedResult(result)).rejects.toThrow();
  repository.close();
  expect(await new LocalRepository(factory).listTimedResults()).toEqual([result]);
});

it('upgrades a version-one database without losing sessions or settings', async () => {
  const factory = new IDBFactory();
  const legacy = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open('cube-trainer', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('sessions', { keyPath: 'id' }).add({ id: 'legacy', name: 'Old session', createdAt: 1 });
      const preferences = request.result.createObjectStore('preferences');
      preferences.put('legacy', 'currentSessionId'); preferences.put({ reportingTimezone: 'UTC' }, 'settings');
    };
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  legacy.close();
  const repository = new LocalRepository(factory);
  expect(await repository.load()).toMatchObject({ sessions: [{ id: 'legacy', name: 'Old session', createdAt: 1 }], currentSessionId: 'legacy', settings: { reportingTimezone: 'UTC' } });
  await repository.saveTimedResult({ id: 'new', sessionId: 'legacy', status: 'completed', startedAt: 2, rawDurationMs: 1.25, penalty: 'none', timingBasis: 'host-monotonic-receipt' });
  expect(await repository.listTimedResults()).toHaveLength(1); repository.close();
});

it('atomically finalizes and clears checkpoints, recovers unfinished attempts exactly once', async () => {
  const repository = new LocalRepository(new IDBFactory()); const session = await repository.createSession('Recovery');
  const result = { id: 'unfinished', sessionId: session.id, status: 'interrupted' as const, startedAt: 123, rawDurationMs: 1234.56, penalty: 'none' as const, timingBasis: 'host-monotonic-receipt' as const, reason: 'Browser interruption', solveStarted: true };
  const checkpoint = { kind: 'timed' as const, id: result.id, phase: 'active' as const, result, facelets: null, rawTurns: [] };
  await repository.saveCheckpoint(checkpoint);
  expect(await repository.listCheckpoints()).toHaveLength(1);
  expect(await repository.recoverInterruptedAttempts()).toEqual([{ ...result, interruptionPhase: 'active', facelets: null, rawTurns: [] }]);
  expect(await repository.listCheckpoints()).toEqual([]);
  expect(await repository.recoverInterruptedAttempts()).toEqual([]);
  await expect(repository.finalizeTimedAttempt({ ...result, status: 'completed', penalty: 'dnf' })).rejects.toThrow('different final result');
  await repository.saveCheckpoint(checkpoint);
  expect(await repository.listCheckpoints()).toEqual([]);
  expect(await repository.listTimedResults()).toEqual([{ ...result, interruptionPhase: 'active', facelets: null, rawTurns: [] }]);
});
it('aborting a result transaction retains its checkpoint for recovery', async () => {
  const repository = new LocalRepository(new IDBFactory()); const session = await repository.createSession('Recovery');
  const result = { id: 'attempt', sessionId: session.id, status: 'interrupted' as const, startedAt: 1, rawDurationMs: 0, penalty: 'none' as const, timingBasis: 'host-monotonic-receipt' as const };
  await repository.saveCheckpoint({ kind: 'timed', id: result.id, phase: 'setup', result, facelets: null, rawTurns: [] });
  await expect(repository.finalizeTimedAttempt({ ...result, sessionId: 'missing' })).rejects.toThrow();
  expect(await repository.listCheckpoints()).toHaveLength(1);
  expect(await repository.listTimedResults()).toEqual([]);
});


it('concurrent recovery transactions preserve one canonical interrupted result', async () => {
  const factory = new IDBFactory(); const first = new LocalRepository(factory); const second = new LocalRepository(factory);
  const session = await first.createSession('Recovery');
  const result = { id: 'concurrent', sessionId: session.id, status: 'interrupted' as const, startedAt: 1, rawDurationMs: 10.25, penalty: 'none' as const, timingBasis: 'host-monotonic-receipt' as const };
  await first.saveCheckpoint({ kind: 'timed', id: result.id, phase: 'active', result, facelets: 'captured state', rawTurns: [] });
  const recovered = await Promise.all([first.recoverInterruptedAttempts(), second.recoverInterruptedAttempts()]);
  expect(recovered.flat()).toHaveLength(1);
  const records = await first.listTimedResults(); expect(records).toHaveLength(1);
  await first.finalizeTimedAttempt(records[0]); await second.finalizeTimedAttempt(records[0]);
  expect(await first.listTimedResults()).toEqual(records); expect(await first.listCheckpoints()).toEqual([]);
  first.close(); second.close();
});
