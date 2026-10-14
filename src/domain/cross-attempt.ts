import { isFacelets, SOLVED, turn } from './cube';
import { isCrossSolved, type CrossCase, type CrossGraph } from './cross';
import type { PhysicalTurn } from './diagnostic';
import { CrossGuidance, countExecutedMoves, type CrossMode } from './cross-guidance';

export interface CrossRecord {
  id: string;
  sessionId: string;
  case: CrossCase;
  mode: CrossMode | 'mixed';
  modeChanges?: CrossModeChange[];
  status: 'completed' | 'abandoned' | 'interrupted';
  startedAt: number | null;
  rawDurationMs: number;
  normalizedExecutedCount: number;
  rawTrace: PhysicalTurn[];
  lastState: string;
  mistakeEpisodes: number;
  revealed: boolean;
  assisted: boolean;
  timingBasis: 'host-monotonic-receipt';
  reason?: string;
}
export interface CrossModeChange { mode: CrossMode; atMoveIndex: number; elapsedMs: number }
export interface CrossCheckpoint { id: string; phase: 'setup' | 'ready' | 'active'; record: CrossRecord }
export interface CrossPersistence {
  saveCheckpoint(checkpoint: CrossCheckpoint): Promise<void>;
  finalize(record: CrossRecord): Promise<void>;
  markRevealed(id: string): Promise<void>;
  clearCheckpoint(id: string): Promise<void>;
}

/** Attempts retain physical activity separately from their accepted optimal prefix. */
export class CrossAttempt {
  phase: 'setup' | 'ready' | 'active' | 'finished' = 'setup';
  private state: string;
  private raw: PhysicalTurn[] = [];
  private startMs: number | null = null;
  private startedAt: number | null = null;
  private revealed = false;
  private finalRecord: CrossRecord | null = null;
  private guidance: CrossGuidance | null;
  private changes: CrossModeChange[];
  private assisted: boolean;
  constructor(readonly id: string, readonly sessionId: string, readonly caseData: CrossCase, public mode: CrossMode = 'free', graph?: CrossGraph) {
    if (!sessionId || !isFacelets(caseData.startingState) || !isFacelets(caseData.scrambleSource ?? SOLVED) || caseData.originalScramble.split(/\s+/).reduce(turn, caseData.scrambleSource ?? SOLVED) !== caseData.startingState || !Number.isInteger(caseData.optimum) || caseData.optimum < 1 || caseData.optimum > 8 || isCrossSolved(caseData.startingState, caseData.color)) throw new Error('A session and valid unsolved cross case are required');
    this.caseData = structuredClone(caseData);
    this.state = caseData.startingState;
    if (!['free', 'semi-guided', 'fully-guided'].includes(mode)) throw new Error('Unknown cross mode');
    if (mode !== 'free' && !graph) throw new Error('Guided practice requires every optimal path');
    this.guidance = mode === 'free' ? null : new CrossGuidance(this.caseData, graph!);
    this.changes = [{ mode, atMoveIndex: 0, elapsedMs: 0 }];
    this.assisted = mode === 'fully-guided';
  }
  setPreparationState(facelets: string): void { if (this.phase === 'setup') { if (!isFacelets(facelets)) throw new Error('Invalid preparation state'); this.state = facelets; } }
  arm(): void { if (this.phase === 'setup') { this.state = this.caseData.startingState; this.phase = 'ready'; } }
  cancelSetup(): void { if (this.phase === 'setup') this.phase = 'finished'; }
  elapsed(hostMs: number): number { return this.finalRecord?.rawDurationMs ?? (this.startMs === null ? 0 : Math.max(0, hostMs - this.startMs)); }
  get facelets(): string { return this.state; }
  get solutionRevealed(): boolean { return this.revealed; }
  get guide() { return this.mode === 'free' ? null : this.guidance?.snapshot() ?? null; }
  get hasGuidance(): boolean { return this.guidance !== null; }
  get isAssisted(): boolean { return this.assisted || this.revealed; }
  switchMode(mode: CrossMode, hostMs: number, graph?: CrossGraph): void {
    if (this.phase === 'finished' || mode === this.mode) return;
    if (!['free', 'semi-guided', 'fully-guided'].includes(mode)) throw new Error('Unknown cross mode');
    if (mode !== 'free') {
      let guidance = this.guidance;
      if (!guidance) {
        if (!graph) throw new Error('Guided practice requires every optimal path');
        guidance = new CrossGuidance(this.caseData, graph);
        for (const event of this.raw) guidance.receive(event.move);
      }
      if (this.phase !== 'setup' && !guidance.reconcile(this.state)) throw new Error('Cube state changed outside recorded moves. Repeat the case before entering guided mode.');
      this.guidance = guidance;
    }
    this.mode = mode;
    this.assisted ||= mode === 'fully-guided';
    this.changes.push({ mode, atMoveIndex: this.raw.length, elapsedMs: this.elapsed(hostMs) });
  }
  reveal(): CrossRecord | null {
    this.revealed = true;
    if (this.finalRecord) { this.finalRecord.revealed = true; this.finalRecord.assisted = true; }
    return this.finalRecord ? structuredClone(this.finalRecord) : null;
  }
  receive(event: PhysicalTurn, wallMs: number, facelets?: string): CrossRecord | null {
    if (this.phase === 'setup' || this.phase === 'finished') return null;
    if (!Number.isFinite(event.hostMs) || (this.raw.length && event.hostMs < this.raw.at(-1)!.hostMs)) throw new Error('Cross timing requires ordered host receipt timestamps');
    if (this.phase === 'ready') { this.startMs = event.hostMs; this.startedAt = wallMs; this.phase = 'active'; }
    this.state = facelets && isFacelets(facelets) ? facelets : turn(this.state, event.move);
    this.raw.push({ ...event });
    if (this.guidance) {
      this.guidance.receive(event.move);
      if (this.mode !== 'free' && !this.guidance.reconcile(this.state)) return this.interrupt(event.hostMs, 'Cube state changed outside the recorded guided moves');
    }
    return isCrossSolved(this.state, this.caseData.color) && (this.mode === 'free' || this.guidance?.completed) ? this.finish('completed', event.hostMs) : null;
  }
  reconcile(facelets: string, hostMs: number): CrossRecord | null {
    if (!isFacelets(facelets) || this.phase === 'finished' || this.phase === 'setup') return null;
    this.state = facelets;
    if (this.mode !== 'free' && this.guidance && !this.guidance.reconcile(facelets)) return this.interrupt(hostMs, 'Cube state changed outside the recorded guided moves');
    return this.phase === 'active' && isCrossSolved(facelets, this.caseData.color) && (this.mode === 'free' || this.guidance?.completed) ? this.finish('completed', hostMs) : null;
  }
  private record(status: CrossRecord['status'], hostMs: number, reason?: string): CrossRecord {
    const mixed = this.changes.length > 1;
    return { id: this.id, sessionId: this.sessionId, case: structuredClone(this.caseData), mode: mixed ? 'mixed' : this.mode, modeChanges: structuredClone(this.changes), status, startedAt: this.startedAt, rawDurationMs: mixed || this.mode === 'free' ? this.elapsed(hostMs) : 0, normalizedExecutedCount: countExecutedMoves(this.raw.map(event => event.move)), rawTrace: structuredClone(this.raw), lastState: this.state, mistakeEpisodes: this.guidance?.mistakeEpisodes ?? 0, revealed: this.revealed, assisted: this.isAssisted, timingBasis: 'host-monotonic-receipt', ...(reason ? { reason } : {}) };
  }
  checkpoint(hostMs: number): CrossCheckpoint {
    if (this.phase === 'finished') throw new Error('Finished cross attempts have no active checkpoint');
    return { id: this.id, phase: this.phase, record: this.record('interrupted', hostMs) };
  }
  private finish(status: CrossRecord['status'], hostMs: number, reason?: string): CrossRecord | null {
    if (this.phase === 'finished') return null;
    const record = this.record(status, hostMs, reason);
    this.finalRecord = record; this.phase = 'finished';
    return structuredClone(record);
  }
  abandon(hostMs: number): CrossRecord | null { return this.phase === 'setup' ? null : this.finish('abandoned', hostMs); }
  interrupt(hostMs: number, reason: string): CrossRecord | null { return this.finish('interrupted', hostMs, reason); }
}
export function recoverCrossCheckpoint(checkpoint: CrossCheckpoint): CrossRecord {
  return { ...structuredClone(checkpoint.record), status: 'interrupted', reason: 'Browser reopened with unfinished cross practice' };
}
