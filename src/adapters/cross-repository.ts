import type { LocalRepository } from './local-repository';
import { recoverCrossCheckpoint, type CrossCheckpoint, type CrossPersistence, type CrossRecord } from '../domain/cross-attempt';

/** Cross storage shares atomic transactions with sessions while staying outside timed results. */
export class CrossRepository implements CrossPersistence {
  constructor(private local: Pick<LocalRepository, 'transaction'>) {}
  clearCheckpoint(id: string): Promise<void> {
    return this.local.transaction(['crossCheckpoints'], 'readwrite', tx => { tx.objectStore('crossCheckpoints').delete(id); return () => undefined; });
  }
  saveCheckpoint(checkpoint: CrossCheckpoint): Promise<void> {
    return this.local.transaction(['crossCheckpoints', 'crossAttempts', 'sessions'], 'readwrite', tx => {
      const session = tx.objectStore('sessions').get(checkpoint.record.sessionId);
      session.onsuccess = () => {
        if (!session.result) { tx.abort(); return; }
        const result = tx.objectStore('crossAttempts').get(checkpoint.id);
        result.onsuccess = () => { if (!result.result) tx.objectStore('crossCheckpoints').put(checkpoint); };
      };
      return () => undefined;
    });
  }
  finalize(record: CrossRecord): Promise<void> {
    return this.local.transaction(['crossAttempts', 'crossCheckpoints', 'sessions'], 'readwrite', tx => {
      const session = tx.objectStore('sessions').get(record.sessionId);
      session.onsuccess = () => {
        if (!session.result) { tx.abort(); return; }
        const previous = tx.objectStore('crossAttempts').get(record.id);
        previous.onsuccess = () => {
          if (previous.result && JSON.stringify({ ...previous.result as CrossRecord, revealed: false, assisted: false }) !== JSON.stringify({ ...record, revealed: false, assisted: false })) { tx.abort(); return; }
          if (!previous.result) tx.objectStore('crossAttempts').add(record);
          tx.objectStore('crossCheckpoints').delete(record.id);
        };
      };
      return () => undefined;
    });
  }
  markRevealed(id: string): Promise<void> {
    return this.local.transaction(['crossAttempts'], 'readwrite', tx => {
      const request = tx.objectStore('crossAttempts').get(id);
      request.onsuccess = () => {
        if (!request.result) { tx.abort(); return; }
        tx.objectStore('crossAttempts').put({ ...request.result as CrossRecord, revealed: true, assisted: true });
      };
      return () => undefined;
    });
  }
  list(): Promise<CrossRecord[]> {
    return this.local.transaction(['crossAttempts'], 'readonly', tx => {
      const request = tx.objectStore('crossAttempts').getAll();
      return () => (request.result as CrossRecord[]).sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0) || a.id.localeCompare(b.id));
    });
  }
  recoverInterruptedAttempts(): Promise<number> {
    return this.local.transaction(['crossAttempts', 'crossCheckpoints'], 'readwrite', tx => {
      let recovered = 0;
      const checkpoints = tx.objectStore('crossCheckpoints').getAll();
      checkpoints.onsuccess = () => {
        for (const checkpoint of checkpoints.result as CrossCheckpoint[]) {
          const result = tx.objectStore('crossAttempts').get(checkpoint.id);
          result.onsuccess = () => {
            if (!result.result) { tx.objectStore('crossAttempts').add(recoverCrossCheckpoint(checkpoint)); recovered++; }
            tx.objectStore('crossCheckpoints').delete(checkpoint.id);
          };
        }
      };
      return () => recovered;
    });
  }
}
