import type { AttemptCheckpoint, Penalty, TimedResult } from '../domain/timed-attempt';
const changeListeners = new WeakMap<IDBFactory, Set<() => void>>();
export interface PracticeSession { id: string; name: string; createdAt: number }
export interface Settings { reportingTimezone: string; inspection?: boolean; debug?: boolean; showFaceLabels?: boolean; mirroredCrossInstructions?: boolean }
export interface LocalData { sessions: PracticeSession[]; currentSessionId: string | null; settings: Settings }
export const DEFAULT_SETTINGS: Settings = { reportingTimezone: 'America/Sao_Paulo', mirroredCrossInstructions: true };

/** Resolve writes only after commit; request success alone is not persistence. */
export class LocalRepository {
  private database: Promise<IDBDatabase> | null = null;
  constructor(private readonly factory: IDBFactory = globalThis.indexedDB) {}
  private readonly unavailableListeners = new Set<() => void>();
  private listeners(): Set<() => void> {
    if (!this.factory) return this.unavailableListeners;
    let listeners = changeListeners.get(this.factory);
    if (!listeners) { listeners = new Set(); changeListeners.set(this.factory, listeners); }
    return listeners;
  }
  subscribe(listener: () => void): () => void {
    const listeners = this.listeners(); listeners.add(listener); return () => { listeners.delete(listener); };
  }
  private committed<T>(write: Promise<T>): Promise<T> {
    return write.then(value => {
      for (const listener of this.listeners()) { try { listener(); } catch { /* Observer failure cannot undo a committed write. */ } }
      return value;
    });
  }

  private open(): Promise<IDBDatabase> {
    if (!this.database) {
      this.database = new Promise<IDBDatabase>((resolve, reject) => {
        if (!this.factory) { reject(new Error('IndexedDB is unavailable.')); return; }
        const request = this.factory.open('cube-trainer', 4);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains('sessions')) request.result.createObjectStore('sessions', { keyPath: 'id' });
          if (!request.result.objectStoreNames.contains('preferences')) request.result.createObjectStore('preferences');
          if (!request.result.objectStoreNames.contains('timedResults')) request.result.createObjectStore('timedResults', { keyPath: 'id' });
          if (!request.result.objectStoreNames.contains('crossAttempts')) request.result.createObjectStore('crossAttempts', { keyPath: 'id' });
          if (!request.result.objectStoreNames.contains('crossCheckpoints')) request.result.createObjectStore('crossCheckpoints', { keyPath: 'id' });
          if (!request.result.objectStoreNames.contains('checkpoints')) request.result.createObjectStore('checkpoints', { keyPath: 'id' });
        };
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('Local storage is blocked by another open page. Close it and retry.'));
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => { db.close(); this.database = null; };
          resolve(db);
        };
      }).catch(error => { this.database = null; throw error; });
    }
    return this.database;
  }

  /** Keep callbacks synchronous so IndexedDB does not auto-commit between requests. */
  async transaction<T>(stores: string[], mode: IDBTransactionMode, work: (transaction: IDBTransaction) => () => T): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(stores, mode);
      transaction.onabort = () => reject(transaction.error ?? new Error('Local transaction was aborted.'));
      let result: () => T;
      transaction.oncomplete = () => { try { resolve(result()); } catch (error) { reject(error); } };
      try { result = work(transaction); }
      catch (error) { transaction.abort(); reject(error); }
    });
  }

  load(): Promise<LocalData> {
    return this.transaction(['sessions', 'preferences'], 'readonly', transaction => {
      const sessions = transaction.objectStore('sessions').getAll();
      const current = transaction.objectStore('preferences').get('currentSessionId');
      const settings = transaction.objectStore('preferences').get('settings');
      return () => ({ sessions: (sessions.result as PracticeSession[]).sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)), currentSessionId: (current.result as string | undefined) ?? null, settings: (settings.result as Settings | undefined) ?? { ...DEFAULT_SETTINGS } });
    });
  }

  /** Serialized read/write migration: concurrent tabs cannot create duplicate defaults. */
  async initialize(): Promise<LocalData> {
    await this.committed(this.transaction(['sessions', 'preferences'], 'readwrite', transaction => {
      const store = transaction.objectStore('sessions');
      const preferences = transaction.objectStore('preferences');
      const sessions = store.getAll();
      const current = preferences.get('currentSessionId');
      const settings = preferences.get('settings');
      sessions.onsuccess = () => {
        const values = sessions.result as PracticeSession[];
        let defaultSession = values.find(value => value.name === 'Default');
        if (!defaultSession) {
          defaultSession = { id: crypto.randomUUID(), name: 'Default', createdAt: Date.now() };
          store.add(defaultSession); values.push(defaultSession);
        }
        current.onsuccess = () => {
          if (!values.some(value => value.id === current.result)) preferences.put(defaultSession.id, 'currentSessionId');
        };
      };
      settings.onsuccess = () => preferences.put({ inspection: false, debug: false, ...DEFAULT_SETTINGS, ...settings.result }, 'settings');
      return () => undefined;
    }));
    return this.load();
  }

  async createSession(name: string, createdAt = Date.now()): Promise<PracticeSession> {
    if (!name.trim()) throw new Error('Enter a session name.');
    const session = { id: crypto.randomUUID(), name: name.trim(), createdAt };
    return this.committed(this.transaction(['sessions', 'preferences'], 'readwrite', transaction => {
      transaction.objectStore('sessions').add(session);
      transaction.objectStore('preferences').put(session.id, 'currentSessionId');
      return () => session;
    }));
  }

  async selectSession(id: string): Promise<void> {
    let missing = false;
    try {
      await this.committed(this.transaction(['sessions', 'preferences'], 'readwrite', transaction => {
        const request = transaction.objectStore('sessions').get(id);
        request.onsuccess = () => {
          if (!request.result) { missing = true; transaction.abort(); }
          else transaction.objectStore('preferences').put(id, 'currentSessionId');
        };
        return () => undefined;
      }));
    } catch (error) { if (missing) throw new Error('Session does not exist.', { cause: error }); throw error; }
  }

  async saveSettings(settings: Settings): Promise<void> {
    try { new Intl.DateTimeFormat('en', { timeZone: settings.reportingTimezone }); }
    catch (cause) { throw new Error('Enter a valid IANA reporting timezone.', { cause }); }
    // Reject offset-only values, even on engines that accept them.
    if (!settings.reportingTimezone || /^[+-]/.test(settings.reportingTimezone)) throw new Error('Enter a valid IANA reporting timezone.');
    return this.committed(this.transaction(['preferences'], 'readwrite', transaction => {
      transaction.objectStore('preferences').put(settings, 'settings');
      return () => undefined;
    }));
  }

  saveTimedResult(result: TimedResult): Promise<void> {
    return this.committed(this.transaction(['timedResults', 'sessions'], 'readwrite', transaction => {
      const session = transaction.objectStore('sessions').get(result.sessionId);
      session.onsuccess = () => {
        if (!session.result) transaction.abort();
        else transaction.objectStore('timedResults').add(result);
      };
      return () => undefined;
    }));
  }
  async editTimedPenalty(id: string, penalty: Penalty): Promise<void> {
    if (!['none', '+2', 'dnf'].includes(penalty)) throw new Error('Choose no penalty, +2, or DNF.');
    let invalid = false;
    try { await this.committed(this.transaction(['timedResults'], 'readwrite', transaction => {
      const request = transaction.objectStore('timedResults').get(id);
      request.onsuccess = () => {
        const result = request.result as TimedResult | undefined;
        if (!result || result.status !== 'completed') { invalid = true; transaction.abort(); }
        else transaction.objectStore('timedResults').put({ ...result, penalty });
      };
      return () => undefined;
    })); } catch (error) { if (invalid) throw new Error('Only an existing completed result can have its penalty edited.', { cause: error }); throw error; }
  }
  deleteTimedResult(id: string): Promise<void> {
    return this.committed(this.transaction(['timedResults'], 'readwrite', transaction => {
      transaction.objectStore('timedResults').delete(id); return () => undefined;
    }));
  }
  listTimedResults(): Promise<TimedResult[]> {
    return this.transaction(['timedResults'], 'readonly', transaction => {
      const results = transaction.objectStore('timedResults').getAll();
      return () => (results.result as TimedResult[]).sort((a, b) => a.startedAt - b.startedAt || a.id.localeCompare(b.id));
    });
  }

  saveCheckpoint(checkpoint: AttemptCheckpoint): Promise<void> {
    return this.transaction(['checkpoints', 'timedResults'], 'readwrite', transaction => {
      const result = transaction.objectStore('timedResults').get(checkpoint.id);
      result.onsuccess = () => { if (!result.result) transaction.objectStore('checkpoints').put(checkpoint); };
      return () => undefined;
    });
  }
  clearCheckpoint(id: string): Promise<void> {
    return this.transaction(['checkpoints'], 'readwrite', transaction => {
      transaction.objectStore('checkpoints').delete(id); return () => undefined;
    });
  }
  listCheckpoints(): Promise<AttemptCheckpoint[]> {
    return this.transaction(['checkpoints'], 'readonly', transaction => {
      const request = transaction.objectStore('checkpoints').getAll(); return () => request.result as AttemptCheckpoint[];
    });
  }
  /** Both the result and removal commit together. First finalization wins. */
  async finalizeTimedAttempt(result: TimedResult): Promise<void> {
    let conflict = false;
    try { await this.committed(this.transaction(['checkpoints', 'timedResults', 'sessions'], 'readwrite', transaction => {
      const existing = transaction.objectStore('timedResults').get(result.id);
      existing.onsuccess = () => {
        if (existing.result) {
          if (JSON.stringify(existing.result) !== JSON.stringify(result)) { conflict = true; transaction.abort(); return; }
          transaction.objectStore('checkpoints').delete(result.id); return;
        }
        const session = transaction.objectStore('sessions').get(result.sessionId);
        session.onsuccess = () => {
          if (!session.result) transaction.abort();
          else {
            transaction.objectStore('timedResults').add(result);
            transaction.objectStore('checkpoints').delete(result.id);
          }
        };
      };
      return () => undefined;
    })); } catch (error) { if (conflict) throw new Error('A different final result already exists for this attempt. Refresh to review the persisted record.', { cause: error }); throw error; }
  }
  /** Recovery is atomic across all leftovers; concurrent reopeners cannot duplicate. */
  recoverInterruptedAttempts(): Promise<TimedResult[]> {
    return this.committed(this.transaction(['checkpoints', 'timedResults'], 'readwrite', transaction => {
      const recovered: TimedResult[] = [];
      const request = transaction.objectStore('checkpoints').getAll();
      request.onsuccess = () => {
        for (const checkpoint of request.result as AttemptCheckpoint[]) {
          if (checkpoint.kind !== 'timed') continue;
          const existing = transaction.objectStore('timedResults').get(checkpoint.id);
          existing.onsuccess = () => {
            if (!existing.result) {
              const result = { ...checkpoint.result, status: 'interrupted' as const, reason: 'Browser interruption', interruptionPhase: checkpoint.phase, facelets: checkpoint.facelets, rawTurns: checkpoint.rawTurns };
              transaction.objectStore('timedResults').add(result); recovered.push(result);
            }
            transaction.objectStore('checkpoints').delete(checkpoint.id);
          };
        }
      };
      return () => recovered;
    }));
  }

  close(): void { void this.database?.then(db => db.close(), () => {}); this.database = null; }
}

