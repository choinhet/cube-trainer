export type Penalty = "none" | "+2" | "dnf";
export interface TimedResult {
  id: string;
  sessionId: string;
  status: "completed" | "interrupted";
  startedAt: number;
  rawDurationMs: number;
  penalty: Penalty;
  timingBasis: "host-monotonic-receipt";
  reason?: string;
  interruptionPhase?: AttemptPhase;
  solveStarted?: boolean;
  facelets?: string | null;
  rawTurns?: AttemptCheckpoint["rawTurns"];
  inspectionElapsedMs?: number;
  /** Version of durable full-state/physical-trace inputs for offline analysis. */
  analysisInputVersion?: 1;
}
export type AttemptPhase =
  | "setup"
  | "ready"
  | "inspection"
  | "active"
  | "completed"
  | "interrupted"
  | "canceled";
export interface AttemptCheckpoint {
  kind: "timed";
  id: string;
  phase: AttemptPhase;
  result: TimedResult;
  facelets: string | null;
  rawTurns: {
    move: string;
    serial: number;
    hostMs: number;
    deviceMs: number | null;
    recovered?: boolean;
  }[];
}
export function inspectionPenalty(elapsedMs: number): Penalty {
  return elapsedMs >= 17000 ? "dnf" : elapsedMs >= 15000 ? "+2" : "none";
}
export function formatSolveTime(
  result: Pick<TimedResult, "rawDurationMs" | "penalty">,
): string {
  const raw = (result.rawDurationMs / 1000).toFixed(2);
  return result.penalty === "dnf"
    ? `DNF (${raw})`
    : result.penalty === "+2"
      ? `${((result.rawDurationMs + 2000) / 1000).toFixed(2)} (+2)`
      : raw;
}
/** One adapter host monotonic clock for arming, starting and stopping. Wall time is metadata. */
export class TimedAttempt {
  phase: AttemptPhase = "setup";
  private armedMs = 0;
  private startMs = 0;
  private wallStart = 0;
  private penalty: Penalty = "none";
  constructor(
    readonly id: string,
    readonly sessionId: string,
    readonly inspection: boolean,
    private readonly createdAt = Date.now(),
  ) {}
  get terminal(): boolean {
    return ["completed", "interrupted", "canceled"].includes(this.phase);
  }
  interruptedData(hostMs: number, reason: string): TimedResult {
    return {
      id: this.id,
      sessionId: this.sessionId,
      status: "interrupted",
      startedAt: this.phase === "active" ? this.wallStart : this.createdAt,
      rawDurationMs: this.phase === "active" ? hostMs - this.startMs : 0,
      penalty: this.penalty,
      timingBasis: "host-monotonic-receipt",
      reason,
      interruptionPhase: this.phase,
      solveStarted: this.phase === "active",
      inspectionElapsedMs: this.inspection
        ? this.phase === "active"
          ? this.startMs - this.armedMs
          : this.phase === "inspection"
            ? hostMs - this.armedMs
            : 0
        : 0,
    };
  }
  interrupt(hostMs: number, reason: string): TimedResult | null {
    if (this.terminal) return null;
    const result = this.interruptedData(hostMs, reason);
    this.phase = "interrupted";
    return result;
  }
  abandon(hostMs: number): TimedResult | null {
    if (this.terminal) return null;
    if (this.phase !== "active") {
      this.phase = "canceled";
      return null;
    }
    this.penalty = "dnf";
    return this.turn(hostMs, this.wallStart, true);
  }
  arm(hostMs: number): void {
    if (this.phase !== "setup") return;
    this.armedMs = hostMs;
    this.phase = this.inspection ? "inspection" : "ready";
  }
  elapsed(hostMs: number): number {
    return this.phase === "active"
      ? Math.max(0, hostMs - this.startMs)
      : this.phase === "inspection"
        ? Math.max(0, hostMs - this.armedMs)
        : 0;
  }
  turn(hostMs: number, wallMs: number, solved: boolean): TimedResult | null {
    if (this.phase === "ready" || this.phase === "inspection") {
      this.penalty = this.inspection
        ? inspectionPenalty(hostMs - this.armedMs)
        : "none";
      this.startMs = hostMs;
      this.wallStart = wallMs;
      this.phase = "active";
    }
    if (this.phase !== "active" || !solved) return null;
    this.phase = "completed";
    return {
      id: this.id,
      sessionId: this.sessionId,
      status: "completed",
      startedAt: this.wallStart,
      rawDurationMs: hostMs - this.startMs,
      penalty: this.penalty,
      timingBasis: "host-monotonic-receipt",
    };
  }
}
