import type { GanCubeEvent } from 'gan-web-bluetooth';
import { FACES, SOLVED, isFacelets, turn } from './cube';

export type Tracking = 'unvalidated' | 'tracking' | 'invalid';
/** hostMs is delivery time, including recovery; recovered flags retain that distinction. */
export interface PhysicalTurn { move: string; serial: number; hostMs: number; deviceMs: number | null; recovered?: boolean }
export interface TraceEntry { receivedHostMs: number; event: GanCubeEvent }
export class Diagnostic {
  constructor(private allowAheadReports = false) {}
  private pendingReports: { facelets: string; serial: number; hostMs: number }[] = [];
  private firstMove = true;
  // Monotonic recovery counter retained for diagnostics and trace inspection.
  private timingInterruptions = 0;
  private stateConfirmationMs: number | null = null;
  private tracking: Tracking = 'unvalidated';
  private facelets: string | null = null;
  private entries: TraceEntry[] = [];
  private turns: PhysicalTurn[] = [];
  private serial: number | null = null;
  private latestSerial: number | null = null;
  private reason: string | null = null;
  private candidate: { facelets: string; serial: number } | null = null;
  private orientation: { x: number; y: number; z: number; w: number } | null = null;
  private observed = { state: false, gyro: false, moves: false };

  receive(event: GanCubeEvent, hostMs: number): void {
    this.entries.push({ receivedHostMs: hostMs, event: structuredClone(event) });
    if (this.pendingReports.some(report => hostMs - report.hostMs > 2000) || (this.stateConfirmationMs !== null && hostMs - this.stateConfirmationMs > 2000)) this.invalidate('State report did not receive its ordered moves');
    if (event.type === 'FACELETS') {
      this.candidate = null;
      if (!isFacelets(event.facelets) || !Number.isInteger(event.serial) || event.serial < 0 || event.serial > 255) { this.invalidate('Malformed reported state or serial'); return; }
      this.observed.state = true;
      this.latestSerial = event.serial;
      this.candidate = { facelets: event.facelets, serial: event.serial };
      if (this.tracking === 'tracking' && event.serial === this.serial && event.facelets === this.facelets) this.stateConfirmationMs = null;
      if (this.tracking === 'tracking' && (event.serial !== this.serial || event.facelets !== this.facelets)) {
        const ahead = this.serial === null ? 0 : (event.serial - this.serial + 256) % 256;
        if (this.allowAheadReports && ahead > 0 && ahead < 128) {
          if (!this.pendingReports.some(report => report.serial === event.serial && report.facelets === event.facelets)) this.pendingReports.push({ facelets: event.facelets, serial: event.serial, hostMs });
        } else this.invalidate('Reported state or serial differs from tracked state');
      }
    } else if (event.type === 'GYRO') {
      if (!Object.values(event.quaternion).every(Number.isFinite) || Math.hypot(event.quaternion.x, event.quaternion.y, event.quaternion.z, event.quaternion.w) === 0) return;
      this.orientation = { ...event.quaternion };
      this.observed.gyro = true;
    } else if (event.type === 'DISCONNECT') {
      this.candidate = null;
      this.invalidate('Disconnected');
    } else if (event.type === 'MOVE') {
      this.candidate = null;
      const startupZero = this.allowAheadReports && this.firstMove && this.serial === 0 && event.serial === 0;
      this.firstMove = false;
      if (!Number.isInteger(event.serial) || event.serial < 0 || event.serial > 255) { this.invalidate('Malformed move serial'); return; }
      this.latestSerial = event.serial;
      this.observed.moves = true;
      if (this.tracking !== 'tracking' || !this.facelets) return;
      if (!startupZero && this.serial !== null && event.serial !== (this.serial + 1) % 256) {
        this.invalidate('Duplicate, out-of-order, or missing move serial'); return;
      }
      const recovered = event.localTimestamp === null;
      if (recovered && !this.allowAheadReports) { this.invalidate('Recovered move has no live receipt timestamp'); return; }
      if (!/^[URFDLB]'?$/.test(event.move) || FACES.indexOf(event.move[0]) !== event.face || (event.move.endsWith("'") ? 1 : 0) !== event.direction) {
        this.invalidate('Unsupported move or inconsistent face mapping'); return;
      }
      this.facelets = turn(this.facelets, event.move);
      if (startupZero || recovered) this.stateConfirmationMs ??= hostMs;
      if (recovered) this.timingInterruptions++;
      this.serial = event.serial;
      this.turns.push({ move: event.move, serial: event.serial, hostMs, deviceMs: event.cubeTimestamp, ...(recovered ? { recovered: true } : {}) });
      const reports = this.pendingReports.filter(report => report.serial === this.serial);
      if (reports.some(report => report.facelets !== this.facelets)) this.invalidate('Reported state differs from ordered moves');
      else if (reports.length) this.stateConfirmationMs = null;
      this.pendingReports = this.pendingReports.filter(report => report.serial !== this.serial);
    }
  }
  confirmState(): void {
    if (!this.candidate) throw new Error('Request fresh state while keeping the cube still');
    this.facelets = this.candidate.facelets;
    this.serial = this.candidate.serial;
    this.tracking = 'tracking';
    this.pendingReports = [];
    this.stateConfirmationMs = null;
    this.reason = null;
    this.candidate = null;
  }
  confirmPhysicallySolved(): void {
    if (this.candidate && this.candidate.facelets !== SOLVED) throw new Error('Synchronize the conflicting reported state instead');
    this.facelets = SOLVED;
    this.serial = this.latestSerial;
    this.tracking = 'tracking';
    this.pendingReports = [];
    this.stateConfirmationMs = null;
    this.reason = null;
    this.candidate = null;
  }
  invalidate(reason: string): void { this.tracking = 'invalid'; this.reason = reason; this.pendingReports = []; this.stateConfirmationMs = null; }
  snapshot() { return { tracking: this.tracking, awaitingMoves: this.pendingReports.length > 0 || this.stateConfirmationMs !== null, timingInterruptions: this.timingInterruptions, facelets: this.facelets, candidate: this.candidate ? { ...this.candidate } : null, reason: this.reason, turns: structuredClone(this.turns), serial: this.serial, orientation: this.orientation ? { ...this.orientation } : null, observed: { ...this.observed } }; }
  trace(): TraceEntry[] { return structuredClone(this.entries); }
}
