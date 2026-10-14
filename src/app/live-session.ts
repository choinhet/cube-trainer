import { TimedAttempt, type AttemptCheckpoint, type TimedResult } from '../domain/timed-attempt';
import type { Connection } from '../domain/session';
import type { GanCubeEvent } from 'gan-web-bluetooth';
import { DiagnosticSession } from '../domain/session';
import { Diagnostic } from '../domain/diagnostic';
import type { Quaternion } from '../domain/cube-orientation';
import { SOLVED, turn } from '../domain/cube';
import { Guidance, normalizeTurns } from '../domain/guidance';
import type { PracticeScramble } from '../domain/scramble';
import { requestPracticeScramble } from '../workers/scramble-client';
import { withSetupMinimum, validateSetup, validateTarget, type ExerciseTarget, type SetupSolver } from '../domain/setup';
import { requestExerciseSetup } from '../workers/setup-client';
import { CrossFlow } from '../domain/cross-flow';
import { CrossClient } from '../workers/cross-client';
import { isCrossSolved, type CrossColor } from '../domain/cross';
import type { CrossPersistence, CrossRecord } from '../domain/cross-attempt';
import type { CrossGenerator } from '../domain/cross-practice';
import type { CrossMode, CrossOptions } from '../domain/cross-guidance';
export type Activity = 'idle' | 'setup' | 'scramble' | 'correction' | 'inspection' | 'timed-solve' | 'cross-attempt' | 'retry';
export interface AttemptPersistence { checkpoint(value: AttemptCheckpoint): Promise<void>; clear(id: string): Promise<void> }

/** Recovered turns preserve attempts; fresh reports repair tracking automatically. */
export class LiveSession extends DiagnosticSession {
  constructor(chooser: () => Promise<Connection>, private readonly monotonicClock: () => number, notify: () => void, private readonly wallClock: () => number = Date.now) { super(chooser, monotonicClock, notify); }
  private timedAttempt: TimedAttempt | null = null;
  private saveResult: ((result: TimedResult) => Promise<void>) | null = null;
  private completedResult: TimedResult | null = null;
  private previousTimedResult: TimedResult | null = null;
  private previousCrossResult: CrossRecord | null = null;
  get previousSolve() { return this.previousTimedResult; }
  get previousCross() { return this.previousCrossResult; }
  private saveState: 'pending' | 'saved' | 'failed' | null = null;
  private saveError: string | null = null;
  private persistence: AttemptPersistence | null = null;
  private writes: Promise<void> = Promise.resolve();
  private checkpointError: string | null = null;
  private requiresSynchronization = false;
  private attemptTurnOffset = 0;
  private solveTurnOffset: number | null = null;
  private crossFlow: CrossFlow | null = null;
  private crossRequested = false;
  private crossClient = new CrossClient();
  get cross() { return this.crossFlow?.snapshot() ?? null; }
  get isCrossPractice(): boolean { return this.crossRequested || !!this.crossFlow; }
  async startCrossPreparation(sessionId: string, color: CrossColor, difficulty: number, store: CrossPersistence, generate?: CrossGenerator, solve?: SetupSolver, options: CrossOptions = {}): Promise<void> {
    if (!sessionId) throw new Error('Select a saved session before starting cross practice');
    if (this.activity !== 'idle' || this.preparationState || this.timedAttempt || this.isCrossPractice) throw new Error('Cancel or clear the current practice before generating a cross case');
    if (!this.canPractice) throw new Error('Wait for the cube to connect and report its state');
    this.crossRequested = true;
    await this.startPreparation(async signal => {
      const cancel = () => this.crossClient.dispose('Cross generation cancelled');
      signal.addEventListener('abort', cancel, { once: true });
      let generated;
      try { generated = generate ? await generate(color, difficulty, signal) : (await this.crossClient.generate(color, difficulty, this.diagnostic.snapshot().facelets!)).result; }
      finally { signal.removeEventListener('abort', cancel); }
      if (signal.aborted) throw new Error('Cross generation cancelled');
      if (generated.color !== color || generated.optimum !== difficulty) throw new Error('Generated cross did not match the requested color and exact difficulty');
      const generatedMoves = validateTarget({ original: generated.originalScramble, target: generated.startingState, source: generated.scrambleSource });
      const source = this.diagnostic.snapshot().facelets!;
      // A prefetched case can be applied directly to any completed cross.
      // Its other pieces follow the full scramble from their current positions.
      if (!options.repeat && !options.imported && generated.scrambleSource && source !== generated.scrambleSource && isCrossSolved(generated.scrambleSource, color)) {
        let prefix: string[] = [];
        if (!isCrossSolved(source, color)) {
          signal.addEventListener('abort', cancel, { once: true });
          try { prefix = (await this.crossClient.query(color, source)).result.continuation; }
          finally { signal.removeEventListener('abort', cancel); }
        }
        if (signal.aborted) throw new Error('Cross generation cancelled');
        let moves = [...prefix, ...generatedMoves];
        let previous: string;
        do { previous = moves.join(' '); moves = normalizeTurns(moves); } while (previous !== moves.join(' '));
        const startingState = moves.reduce(turn, source);
        generated = { ...generated, originalScramble: moves.join(' '), startingState, scrambleSource: source, caseId: `cross-v1:${color}:${startingState}` };
      }
      const graph = options.mode && options.mode !== 'free' ? await this.crossClient.graph(color, generated.startingState, signal) : undefined;
      if (signal.aborted) throw new Error('Cross guidance cancelled');
      const flow = new CrossFlow(crypto.randomUUID(), sessionId, generated, store, () => {
        if (this.crossFlow !== flow) return;
        if (flow.attempt.phase === 'finished') {
          const result = flow.snapshot().result;
          if (result?.status === 'completed') this.previousCrossResult = result;
          if (flow.snapshot().result?.status === 'interrupted') this.requiresSynchronization = true;
          this.setActivity('idle');
        } else if (flow.attempt.phase === 'active') this.setActivity(flow.snapshot().guidance?.status === 'correction' ? 'correction' : 'cross-attempt');
        this.notify();
      }, this.monotonicClock, options.mode, graph);
      this.crossFlow = flow;
      flow.preparation(this.diagnostic.snapshot().facelets!);
      return { original: generated.originalScramble, target: generated.startingState, source: generated.scrambleSource, ...(options.repeat ? { minimumSetupMoves: 15 } : {}) };
    }, solve);
  }
  private armCross(): void {
    if (this.crossFlow?.attempt.phase !== 'setup') return;
    this.crossFlow.arm(); this.setActivity('cross-attempt');
  }
  checkpointCross(): void { this.crossFlow?.checkpoint(); }
  async switchCrossMode(mode: CrossMode): Promise<void> {
    const flow = this.crossFlow;
    if (!flow || flow.attempt.phase === 'finished' || this.cross?.saveState === 'pending' || this.cross?.saveState === 'failed') return;
    const graph = mode !== 'free' && !flow.attempt.hasGuidance
      ? await this.crossClient.graph(flow.attempt.caseData.color, flow.attempt.caseData.startingState, new AbortController().signal) : undefined;
    if (this.crossFlow !== flow || flow.snapshot().phase === 'finished') return;
    flow.switchMode(mode, graph);
  }
  async replaceCrossPreparation(): Promise<void> {
    const flow = this.crossFlow;
    if (!flow) {
      if (this.crossRequested) { this.generationAbort?.abort(); this.clearCrossState(); }
      return;
    }
    if (flow.snapshot().revealing || flow.snapshot().saveState === 'failed') throw new Error('Finish saving or revealing the current attempt before importing');
    this.generationAbort?.abort();
    if (flow.attempt.phase === 'setup') await flow.cancelSetup();
    else { if (flow.attempt.phase !== 'finished') flow.abandon(); await flow.settled(); }
    if (flow.snapshot().saveState !== 'saved') throw new Error('The previous cross attempt could not be saved');
    if (this.crossFlow === flow) this.clearCrossState();
  }
  retryCrossSave(): void {
    if (this.crossFlow?.attempt.phase === 'finished' && !this.cross?.result) void this.clearCrossSetup();
    else this.crossFlow?.retrySave();
  }
  async revealCrossSolution(): Promise<void> {
    const flow = this.crossFlow;
    if (!flow || flow.attempt.phase === 'setup' || flow.snapshot().saveState === 'failed' || flow.snapshot().saveState === 'pending') return;
    await flow.reveal(async () => (await this.crossClient.query(flow.attempt.caseData.color, flow.attempt.caseData.startingState)).result.continuation);
  }
  cancelCrossPractice(): void {
    const snapshot = this.cross;
    if (snapshot?.revealing || snapshot?.saveState === 'pending' || snapshot?.saveState === 'failed') return;
    if (snapshot?.phase === 'ready' || snapshot?.phase === 'active') { this.crossFlow!.abandon(); return; }
    if (snapshot?.phase === 'setup') { this.generationAbort?.abort(); void this.clearCrossSetup(); return; }
    this.clearCrossState();
  }
  private clearCrossState(): void { this.crossClient.dispose(); this.crossFlow = null; this.crossRequested = false; this.clearPreparation(); }
  private async clearCrossSetup(): Promise<void> {
    const flow = this.crossFlow;
    if (!flow) return;
    await flow.cancelSetup();
    if (this.crossFlow === flow && flow.snapshot().saveState === 'saved') this.clearCrossState();
  }
  private interruptCross(reason: string): void {
    if (!this.crossFlow || this.crossFlow.attempt.phase === 'finished') return;
    this.requiresSynchronization = true;
    this.crossFlow.interrupt(reason);
  }
  get timed() {
    return this.timedAttempt ? { phase: this.timedAttempt.phase, elapsedMs: this.timedAttempt.elapsed(this.monotonicClock()), result: this.completedResult, saveState: this.saveState, error: this.saveError, checkpointError: this.checkpointError } : null;
  }
  async startTimedPreparation(sessionId: string, inspection: boolean, save: (result: TimedResult) => Promise<void>, generate?: (signal: AbortSignal) => Promise<ExerciseTarget>, solve?: SetupSolver, persistence?: AttemptPersistence): Promise<void> {
    if (!sessionId) throw new Error('Select a saved session before starting practice');
    if (this.activity !== 'idle' || this.preparationState || this.timedAttempt || this.isCrossPractice) throw new Error('Cancel the current preparation before generating another scramble');
    if (!this.canPractice) throw new Error('Wait for the cube to connect and report its state');
    this.timedAttempt = new TimedAttempt(crypto.randomUUID(), sessionId, inspection, this.wallClock());
    this.saveResult = save; this.completedResult = null; this.saveState = null; this.saveError = null;
    this.persistence = persistence ?? null; this.checkpointError = null; this.writes = Promise.resolve();
    const snapshot = this.diagnostic.snapshot(); this.attemptTurnOffset = snapshot.turns.length; this.solveTurnOffset = null;
    this.notify();
    if (this.persistence) {
      await this.persistCheckpoint();
      if (this.checkpointError || !this.timedAttempt || this.timedAttempt.terminal) return;
      const current = this.diagnostic.snapshot();
      if (!this.canPractice || current.facelets !== snapshot.facelets || current.turns.length !== snapshot.turns.length) {
        this.failPreparation('Cube moved while saving the initial checkpoint. Keep it still and retry preparation.'); return;
      }
    }
    await this.startPreparation(generate, solve);
  }
  private persistCheckpoint(): Promise<void> {
    const attempt = this.timedAttempt;
    const persistence = this.persistence;
    if (!attempt || attempt.terminal || !persistence) return Promise.resolve();
    const snapshot = this.diagnostic.snapshot();
    const checkpoint: AttemptCheckpoint = { kind: 'timed', id: attempt.id, phase: attempt.phase,
      result: attempt.interruptedData(this.monotonicClock(), 'Browser interruption'), facelets: snapshot.facelets, rawTurns: snapshot.turns.slice(this.attemptTurnOffset) };
    this.writes = this.writes.then(() => persistence.checkpoint(checkpoint)).catch(error => {
      if (this.timedAttempt !== attempt) return;
      this.checkpointError = `Active attempt checkpoint was not saved: ${String(error)}`;
      if (attempt.phase === 'setup') {
        this.failPreparation(this.checkpointError);
        if (!attempt.terminal) this.interruptTimed(this.checkpointError);
      }
      this.notify();
    });
    return this.writes;
  }
  private interruptTimed(reason: string): void {
    if (!this.timedAttempt || this.timedAttempt.terminal) return;
    this.requiresSynchronization = true;
    const result = this.timedAttempt.interrupt(this.monotonicClock(), reason);
    if (result) {
      const snapshot = this.diagnostic.snapshot();
      this.completeTimed({ ...result, facelets: snapshot.facelets, rawTurns: snapshot.turns.slice(this.attemptTurnOffset) });
    }
  }
  retrySave(): void {
    if (this.completedResult && this.saveState === 'failed') this.completeTimed(this.completedResult);
    else if (this.timedAttempt?.phase === 'canceled' && this.saveState === 'failed') {
      this.saveState = null;
      // A cancellation retry must remove its checkpoint before another attempt.
      const attempt = this.timedAttempt;
      if (this.persistence) {
        this.saveState = 'pending';
        this.writes = this.writes.then(() => this.persistence!.clear(attempt.id)).then(() => {
          if (this.timedAttempt === attempt) { this.saveState = null; this.clearPreparation(); this.notify(); }
        }, error => { this.saveState = 'failed'; this.saveError = String(error); this.notify(); });
      }
    }
  }
  checkpointActiveAttempt(): void { void this.persistCheckpoint(); }
  requireResynchronization(): void { this.requiresSynchronization = true; void this.request('REQUEST_FACELETS'); this.notify(); }
  private armTimed(hostMs: number): void {
    if (this.timedAttempt?.phase !== 'setup') return;
    this.timedAttempt.arm(hostMs);
    this.setActivity(this.timedAttempt.inspection ? 'inspection' : 'setup');
    void this.persistCheckpoint();
  }
  private completeTimed(result: TimedResult): void {
    const snapshot = this.diagnostic.snapshot();
    result = { ...result, facelets: result.facelets ?? snapshot.facelets, rawTurns: result.rawTurns ?? snapshot.turns.slice(this.solveTurnOffset ?? this.attemptTurnOffset) };
    this.completedResult = result;
    if (result.status === 'completed') this.previousTimedResult = result;
    this.saveState = 'pending';
    const attempt = this.timedAttempt;
    const save = this.saveResult!;
    this.setActivity('idle');
    this.writes = this.writes.then(() => save(result)).then(() => {
      if (this.timedAttempt === attempt) { this.saveState = 'saved'; this.notify(); }
    }, error => {
      if (this.timedAttempt === attempt) { this.saveState = 'failed'; this.saveError = String(error); this.notify(); }
    });
  }
  private preparationState: 'loading' | 'preparing' | 'correction' | 'ready' | 'error' | null = null;
  private preparationError: string | null = null;
  private guide: Guidance | null = null;
  private scramble: PracticeScramble | null = null;
  private generationAbort: AbortController | null = null;
  private loadingStage: 'generation' | 'solving' = 'generation';
  get preparation() {
    return this.preparationState ? { status: this.preparationState, loadingStage: this.loadingStage, error: this.preparationError, scramble: this.scramble, guide: this.guide?.snapshot() ?? null } : null;
  }
  async startPreparation(generate: (signal: AbortSignal) => Promise<ExerciseTarget> = requestPracticeScramble, solve: SetupSolver = requestExerciseSetup): Promise<void> {
    if (this.activity !== 'idle' || this.preparationState) throw new Error('Cancel the current preparation before generating another scramble');
    if (!this.canPractice) throw new Error('Wait for the cube to connect and report its state');
    const controller = new AbortController();
    this.generationAbort = controller;
    this.preparationState = 'loading';
    this.preparationError = null;
    this.loadingStage = 'generation';
    const diagnostic = this.diagnostic;
    const initial = this.diagnostic.snapshot();
    const source = initial.facelets!;
    const requireSource = (): void => {
      const current = this.diagnostic.snapshot();
      if (!this.canPractice || this.diagnostic !== diagnostic || current.turns.length !== initial.turns.length || current.facelets !== source) throw new Error('The cube moved during preparation. Keep it still and retry preparation.');
    };
    this.setActivity('scramble');
    try {
      const generated = await generate(controller.signal);
      if (this.generationAbort !== controller) return;
      requireSource();
      const moves = validateTarget(generated);
      const scramble = { original: generated.original, target: generated.target, moves };
      this.scramble = scramble;
      this.loadingStage = 'solving';
      this.setActivity('setup');
      this.notify();
      const reuseOriginal = source === (generated.source ?? SOLVED) && !(generated.minimumSetupMoves && moves.length > 25);
      const setup = source === scramble.target ? { source, target: scramble.target, moves: [] } : reuseOriginal ? { source, target: scramble.target, moves } : await solve(source, { original: generated.original, target: generated.target, ...(generated.source ? { source: generated.source } : {}), ...(generated.minimumSetupMoves ? { minimumSetupMoves: generated.minimumSetupMoves } : {}) }, controller.signal);
      if (this.generationAbort !== controller) return;
      requireSource();
      this.guide = new Guidance(source, withSetupMinimum(validateSetup(source, scramble.target, setup), generated.minimumSetupMoves).moves);
      this.preparationState = this.guide.snapshot().status;
      if (this.preparationState === 'ready') { this.armTimed(this.monotonicClock()); this.armCross(); }
    } catch (error) {
      if (this.generationAbort !== controller) return;
      this.preparationError = String(error);
      this.preparationState = 'error';
      this.interruptCross(this.preparationError);
    }
    this.notify();
  }
  cancelPreparation(): void {
    if (this.isCrossPractice) { this.cancelCrossPractice(); return; }
    const attempt = this.timedAttempt;
    if (attempt?.phase === 'canceled' && this.saveState === 'failed') { this.retrySave(); return; }
    if (attempt?.phase === 'active') {
      const result = attempt.abandon(this.monotonicClock());
      if (result) this.completeTimed(result);
      return;
    }
    if (this.saveState === 'pending') return;
    if (this.saveState === 'failed' && this.completedResult) return;
    if (attempt && !attempt.terminal && this.persistence) {
      attempt.abandon(this.monotonicClock());
      this.generationAbort?.abort(); this.generationAbort = null;
      this.saveState = 'pending';
      const persistence = this.persistence;
      this.writes = this.writes.then(() => persistence.clear(attempt.id)).then(() => {
        if (this.timedAttempt === attempt) { this.saveState = null; this.clearPreparation(); this.notify(); }
      }, error => { if (this.timedAttempt === attempt) { this.saveState = 'failed'; this.saveError = `Cancellation checkpoint was not cleared: ${String(error)}`; this.notify(); } });
      this.notify(); return;
    }
    this.clearPreparation();
  }
  private clearPreparation(): void {
    this.generationAbort?.abort();
    this.generationAbort = null;
    this.timedAttempt = null;
    this.saveResult = null;
    this.completedResult = null;
    this.saveState = null;
    this.saveError = null;
    this.preparationState = null;
    this.preparationError = null;
    this.guide = null;
    this.scramble = null;
    this.setActivity('idle');
    if (this.requiresSynchronization) void this.request('REQUEST_FACELETS');
  }
  private failPreparation(reason: string): void {
    if ((!this.preparationState && !this.timedAttempt && !this.crossFlow) || this.preparationState === 'error' || this.timedAttempt?.terminal || this.crossFlow?.attempt.phase === 'finished') return;
    this.generationAbort?.abort();
    this.generationAbort = null;
    this.preparationState = 'error';
    this.preparationError = reason;
    this.interruptTimed(reason);
    this.interruptCross(reason);
    this.setActivity('idle');
  }
  private currentActivity: Activity = 'idle';
  private confirmationPending = false;
  private confirmationVersion = 0;
  private gesture: { move: string; serial: number; firstMs: number; lastMs: number; count: number } | null = null;
  get activity(): Activity { return this.currentActivity; }
  get canReset(): boolean { return this.status === 'connected' && this.activity === 'idle' && (!this.crossFlow || (this.crossFlow.attempt.phase === 'finished' && this.cross?.saveState === 'saved')) && (!this.timedAttempt || (this.timedAttempt.terminal && this.saveState !== 'pending')); }
  get solvedResetPending(): boolean { return this.canReset && this.confirmationPending; }
  get solvedResetVersion(): number { return this.confirmationVersion; }
  setActivity(activity: Activity): void {
    if (this.currentActivity === activity) return;
    this.currentActivity = activity;
    this.confirmationPending = false;
    this.gesture = null;
    this.notify();
  }
  private requireIdle(): void {
    if (!this.canReset) throw new Error('Connect a cube and return to idle before resetting or synchronizing');
  }
  requestSolvedReset(): void {
    this.requireIdle();
    this.confirmationPending = true;
    this.confirmationVersion++;
    this.notify();
  }
  cancelSolvedReset(): void { this.confirmationPending = false; this.notify(); }
  protected override onDisconnected(): void {
    if (this.timedAttempt?.phase === 'setup' || this.crossFlow?.attempt.phase === 'setup') this.failPreparation('Connection lost while preparing the cube. Reconnect to continue.');
    this.clearRecoveryTimer();
    this.gesture = null;
    this.confirmationPending = false;
    this.gyroReference = null;
  }
  private recognizeGesture(event: GanCubeEvent, hostMs: number): void {
    if (event.type === 'MOVE') this.confirmationPending = false;
    const snapshot = this.diagnostic.snapshot();
    if (!this.canReset || snapshot.tracking === 'invalid' || snapshot.awaitingMoves) { this.gesture = null; return; }
    if (event.type !== 'MOVE') return;
    // Raw quarters are inspected independently of any future same-face normalizer.
    if (event.localTimestamp === null || !/^[UD]'?$/.test(event.move) ||
      !Number.isInteger(event.serial) || event.serial < 0 || event.serial > 255 ||
      event.face !== (event.move[0] === 'U' ? 0 : 3) || event.direction !== (event.move.endsWith("'") ? 1 : 0)) { this.gesture = null; return; }
    const previous = this.gesture;
    this.gesture = previous && previous.move === event.move && event.serial === (previous.serial + 1) % 256 && hostMs >= previous.lastMs && hostMs - previous.firstMs <= 2000
      ? { ...previous, serial: event.serial, lastMs: hostMs, count: previous.count + 1 }
      : { move: event.move, serial: event.serial, firstMs: hostMs, lastMs: hostMs, count: 1 };
    if (this.gesture.count !== 4) return;
    this.gesture = null;
    if (event.move[0] === 'D') this.requestSolvedReset();
    else if (this.diagnostic.snapshot().orientation) this.resetGyro();
  }
  private gyroReference: Quaternion | null = null;
  viewResetVersion = 0;
  get orientation(): Quaternion | null {
    const q = this.diagnostic.snapshot().orientation;
    const r = this.gyroReference;
    if (!q || !r) return q;
    const scale = Math.hypot(q.x, q.y, q.z, q.w) * Math.hypot(r.x, r.y, r.z, r.w);
    // inverse(reference) * current in the device frame.
    return { x: (r.w*q.x-r.x*q.w-r.y*q.z+r.z*q.y)/scale,
      y: (r.w*q.y+r.x*q.z-r.y*q.w-r.z*q.x)/scale,
      z: (r.w*q.z-r.x*q.y+r.y*q.x-r.z*q.w)/scale,
      w: (r.w*q.w+r.x*q.x+r.y*q.y+r.z*q.z)/scale };
  }
  resetGyro(): void {
    this.requireIdle();
    const orientation = this.diagnostic.snapshot().orientation;
    if (!orientation) throw new Error('Wait for physical orientation before resetting');
    this.gyroReference = orientation;
    this.viewResetVersion++;
    this.notify();
  }
  private recoveryTimer: ReturnType<typeof setTimeout> | null = null;
  private clearRecoveryTimer(): void {
    if (this.recoveryTimer !== null) clearTimeout(this.recoveryTimer);
    this.recoveryTimer = null;
  }
  protected override createDiagnostic(): Diagnostic { this.clearRecoveryTimer(); this.gyroReference = null; this.viewResetVersion++; this.confirmationPending = false; return new Diagnostic(true); }
  readonly timingBasis = 'performance.now() at adapter receipt; Bluetooth latency/batching not compensated';
  get canPractice(): boolean {
    const snapshot = this.diagnostic.snapshot();
    return this.status === 'connected' && snapshot.tracking === 'tracking' && !snapshot.awaitingMoves && !this.requiresSynchronization;
  }
  get state(): 'disconnected' | 'connecting' | 'connected' | 'unsynchronized' {
    return this.status === 'connected' && !this.canPractice ? 'unsynchronized' : this.status;
  }
  protected override onEvent(event: GanCubeEvent, hostMs: number): void {
    this.recognizeGesture(event, hostMs);
    let snapshot = this.diagnostic.snapshot();
    // A fresh report repairs tracking automatically, including after reconnect.
    if (event.type === 'FACELETS' && snapshot.candidate && (snapshot.tracking !== 'tracking' || this.requiresSynchronization)) {
      this.diagnostic.confirmState();
      this.requiresSynchronization = false;
      this.gesture = null;
      snapshot = this.diagnostic.snapshot();
      if (this.crossFlow?.attempt.phase === 'active' || this.crossFlow?.attempt.phase === 'ready') this.crossFlow.reconcile(snapshot.facelets!);
      if (this.timedAttempt?.phase === 'active' && snapshot.facelets === SOLVED) {
        const result = this.timedAttempt.turn(hostMs, this.wallClock(), true);
        if (result) this.completeTimed(result);
      }
    }
    const running = (this.timedAttempt && this.timedAttempt.phase !== 'setup' && !this.timedAttempt.terminal) || (this.crossFlow && ['ready', 'active'].includes(this.crossFlow.attempt.phase));
    if (running && snapshot.tracking !== 'tracking') {
      if (this.status === 'connected' && event.type !== 'DISCONNECT') void this.request('REQUEST_FACELETS');
      return;
    }
    if (this.crossFlow && (this.crossFlow.attempt.phase === 'ready' || this.crossFlow.attempt.phase === 'active') && event.type === 'MOVE') {
      const physical = snapshot.turns.at(-1);
      if (physical?.serial === event.serial) this.crossFlow.receive(physical, this.wallClock(), snapshot.facelets!);
    }
    if (this.timedAttempt && !this.timedAttempt.terminal && !this.preparationState && (event.type === 'MOVE' || snapshot.tracking === 'invalid')) this.failPreparation('Cube moved while preparing the attempt. Preparing another scramble.');
    // Receipt time remains available for recovered turns. Keep the timer running;
    // the raw trace retains recovered flags and any hardware timestamps.
    if (this.timedAttempt && this.timedAttempt.phase !== 'setup' && !this.timedAttempt.terminal && event.type === 'MOVE' && snapshot.turns.at(-1)?.serial === event.serial) {
      if (this.timedAttempt.phase !== 'active') this.solveTurnOffset = snapshot.turns.length - 1;
      const result = this.timedAttempt.turn(hostMs, this.wallClock(), snapshot.facelets === SOLVED);
      if (result) this.completeTimed(result);
      else this.setActivity('timed-solve');
    }
    if (event.type === 'MOVE' && this.preparationState === 'loading') this.failPreparation('The cube moved during preparation. Keep it still and retry preparation.');
    if (!running && this.preparationState && this.timedAttempt?.phase !== 'completed' && (snapshot.tracking === 'invalid' || event.type === 'DISCONNECT')) this.failPreparation('Cube tracking is recovering. Retry preparation when the cube is connected.');
    if (event.type === 'MOVE' && this.preparationState === 'ready' && !this.timedAttempt && !this.crossFlow) this.failPreparation('The prepared target changed. Cancel preparation before starting another flow.');
    if (this.guide && (!this.crossFlow || this.crossFlow.attempt.phase === 'setup') && (this.preparationState === 'preparing' || this.preparationState === 'correction') && event.type === 'MOVE') {
      const physical = snapshot.turns.at(-1);
      if (physical?.serial === event.serial) {
        this.guide.receive(physical);
        const guidance = this.guide.snapshot();
        if (guidance.facelets !== snapshot.facelets) this.failPreparation('Cube state changed during preparation. Retry preparation.');
        else {
          this.crossFlow?.preparation(snapshot.facelets!);
          this.preparationState = guidance.status;
          if (guidance.status === 'ready') { this.armTimed(hostMs); this.armCross(); }
          this.setActivity(guidance.status === 'correction' ? 'correction' : guidance.status === 'ready' ? (this.crossFlow ? 'cross-attempt' : this.timedAttempt?.phase === 'inspection' ? 'inspection' : 'setup') : 'scramble');
        }
      }
    }
    if (snapshot.tracking === 'invalid' && this.status === 'connected' && event.type !== 'DISCONNECT') void this.request('REQUEST_FACELETS');
    if (event.type === 'DISCONNECT') this.clearRecoveryTimer();
    if (event.type === 'MOVE') void this.persistCheckpoint();
    if (event.type === 'MOVE' || (event.type === 'FACELETS' && snapshot.awaitingMoves)) {
      this.clearRecoveryTimer();
      const diagnostic = this.diagnostic;
      // GAN Gen3/4 ignore state-based recovery for 500 ms after a live packet.
      // Request once after a burst, instead of waiting another periodic-report cycle.
      this.recoveryTimer = setTimeout(() => {
        this.recoveryTimer = null;
        if (this.status === 'connected' && this.diagnostic === diagnostic) void this.request('REQUEST_FACELETS');
      }, event.type === 'FACELETS' ? 2100 : 510);
    }
  }
  override async connect(): Promise<void> {
    if (!this.canConnect) return;
    await super.connect();
    await this.request('REQUEST_FACELETS');
  }
  override async disconnect(): Promise<void> {
    this.clearRecoveryTimer();
    await super.disconnect();
  }
  synchronize(): void {
    this.requireIdle();
    const snapshot = this.diagnostic.snapshot();
    if (snapshot.candidate) this.diagnostic.confirmState();
    else if (snapshot.tracking !== 'tracking') throw new Error('Waiting for cube state');
    this.requiresSynchronization = false;
    this.confirmationPending = false;
    this.notify();
  }
  confirmPhysicallySolved(): void {
    this.requireIdle();
    if (!this.confirmationPending) throw new Error('Open solved-cube confirmation before confirming');
    const snapshot = this.diagnostic.snapshot();
    if (snapshot.tracking === 'tracking' && snapshot.facelets !== SOLVED) throw new Error('The reported cube is unsolved. Physically solve it before resetting');
    this.diagnostic.confirmPhysicallySolved();
    this.requiresSynchronization = false;
    this.confirmationPending = false;
    this.notify();
  }
}


