import { CrossAttempt, type CrossPersistence, type CrossRecord } from './cross-attempt';
import type { CrossCase, CrossGraph } from './cross';
import type { CrossMode } from './cross-guidance';
import type { PhysicalTurn } from './diagnostic';

/** Serial persistence prevents an earlier asynchronous checkpoint resurrecting a final attempt. */
export class CrossFlow {
  readonly attempt: CrossAttempt;
  private writes: Promise<void> = Promise.resolve();
  private result: CrossRecord | null = null;
  private saveState: 'pending' | 'saved' | 'failed' | null = null;
  private error: string | null = null;
  private checkpointError: string | null = null;
  private solution: string[] | null = null;
  private revealing = false;
  private setupCancellation = false;
  constructor(id: string, sessionId: string, caseData: CrossCase, private store: CrossPersistence, private notify: () => void, private clock: () => number, mode: CrossMode = 'free', graph?: CrossGraph) {
    this.attempt = new CrossAttempt(id, sessionId, caseData, mode, graph);
  }
  snapshot() {
    return { phase: this.attempt.phase, case: this.attempt.caseData, mode: this.attempt.mode, assisted: this.attempt.isAssisted, guidance: this.attempt.guide, elapsedMs: this.attempt.elapsed(this.clock()), normalizedExecutedCount: this.result?.normalizedExecutedCount ?? (this.attempt.phase === 'ready' || this.attempt.phase === 'active' ? this.attempt.checkpoint(this.clock()).record.normalizedExecutedCount : 0), result: this.result, saveState: this.saveState, error: this.error, revealed: this.attempt.solutionRevealed, solution: this.solution, revealing: this.revealing };
  }
  private write(work: () => Promise<void>, final = false): void {
    if (final) this.saveState = 'pending';
    this.writes = this.writes.then(work).then(() => {
      if (final) { this.saveState = 'saved'; this.error = this.checkpointError; }
      this.notify();
    }, error => {
      if (final) this.saveState = 'failed';
      this.error = String(error);
      if (!final && this.attempt.phase !== 'finished') {
        this.checkpointError = `Cross checkpoint was not saved: ${String(error)}`;
        if (this.attempt.phase === 'setup') this.interrupt(this.checkpointError);
      }
      this.notify();
    });
  }
  checkpoint(): void {
    if (this.attempt.phase === 'finished') return;
    const checkpoint = this.attempt.checkpoint(this.clock());
    this.write(() => this.store.saveCheckpoint(checkpoint));
  }
  arm(): void { this.attempt.arm(); this.checkpoint(); this.notify(); }
  preparation(facelets: string): void { this.attempt.setPreparationState(facelets); this.checkpoint(); }
  cancelSetup(): Promise<void> {
    this.attempt.cancelSetup(); this.setupCancellation = true;
    this.write(() => this.store.clearCheckpoint(this.attempt.id), true); this.notify();
    return this.settled();
  }
  receive(event: PhysicalTurn, wallMs: number, facelets?: string): void {
    const result = this.attempt.receive(event, wallMs, facelets);
    if (result) this.finish(result);
    else this.checkpoint();
    this.notify();
  }
  reconcile(facelets: string): void { this.finish(this.attempt.reconcile(facelets, this.clock())); this.notify(); }
  private finish(result: CrossRecord | null): void {
    if (!result) return;
    this.result = result;
    this.write(() => this.store.finalize(structuredClone(this.result!)), true);
  }
  abandon(): void { this.finish(this.attempt.abandon(this.clock())); this.notify(); }
  switchMode(mode: CrossMode, graph?: CrossGraph): void { this.attempt.switchMode(mode, this.clock(), graph); this.checkpoint(); this.notify(); }
  interrupt(reason: string): void { this.finish(this.attempt.interrupt(this.clock(), reason)); this.notify(); }
  async reveal(query: () => Promise<string[]>): Promise<void> {
    if (this.attempt.mode !== 'free' || this.revealing || this.solution) return;
    this.revealing = true; this.notify();
    try {
      const solution = await query();
      this.solution = solution;
      const record = this.attempt.reveal();
      if (record) { this.result = record; this.persistResult(); }
      else this.checkpoint();
    } catch (error) { this.error = String(error); }
    finally { this.revealing = false; this.notify(); }
    await this.writes;
  }
  private persistResult(): void {
    this.write(async () => {
      const record = structuredClone(this.result!);
      await this.store.finalize(record);
      if (record.revealed) await this.store.markRevealed(record.id);
    }, true);
  }
  retrySave(): void { if (this.saveState === 'failed') { if (this.result) this.persistResult(); else if (this.setupCancellation) void this.cancelSetup(); } this.notify(); }
  settled(): Promise<void> { return this.writes; }
}
