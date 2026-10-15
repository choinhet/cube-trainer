import { expect, it, vi } from 'vitest';
import type { GanCubeEvent } from 'gan-web-bluetooth';
import { LiveSession } from './live-session';
import type { Connection } from '../domain/session';
import { SOLVED, turn } from '../domain/cube';
import { validateScramble } from '../domain/scramble';

it('arms an already matching full target without waiting for a setup turn or solver', async () => {
  const { session, deliver } = harness(); await session.connect();
  const target = validateScramble('R2 U'); deliver(report(10, target.target));
  const solver = vi.fn();
  await session.startPreparation(async () => target, solver);
  expect(session.preparation?.status).toBe('ready');
  expect(session.preparation?.guide?.sequence).toEqual([]);
  expect(session.preparation?.guide?.raw).toEqual([]);
  expect(solver).not.toHaveBeenCalled();
});

it.each(['movement', 'disconnect', 'cancel', 'mismatch', 'solver error'])('cannot arm a stale or invalid setup after %s', async failure => {
  const { session, deliver } = harness(); await session.connect();
  const source = turn(SOLVED, 'F'); deliver(report(10, source));
  const target = validateScramble('R U');
  let finish!: (value: { source: string; target: string; moves: string[] }) => void;
  let reject!: (error: Error) => void;
  let signal!: AbortSignal;
  const pending = session.startPreparation(async () => ({ original: target.original, target: target.target }), (_source, _target, abort) => {
    signal = abort;
    return new Promise((resolve, fail) => { finish = resolve; reject = fail; });
  });
  await Promise.resolve();
  expect(session.preparation?.loadingStage).toBe('solving');
  if (failure === 'movement') { deliver(move(11)); deliver(move(12, "R'")); }
  if (failure === 'disconnect') deliver({ type: 'DISCONNECT', timestamp: 2 });
  if (failure === 'cancel') {
    session.cancelPreparation();
    await session.startPreparation(async () => validateScramble('L'), async () => ({ source, target: turn(SOLVED, 'L'), moves: ["F'", 'L'] }));
  }
  if (failure === 'solver error') reject(new Error('Solver unavailable'));
  else finish({ source: failure === 'mismatch' ? SOLVED : source, target: target.target, moves: ["F'", 'R', 'U'] });
  await pending;
  if (failure === 'cancel') {
    expect(session.preparation?.scramble?.original).toBe('L');
    expect(session.preparation?.status).toBe('preparing');
  } else {
    expect(session.preparation?.status).toBe('error');
    expect(session.preparation?.guide).toBeNull();
  }
  if (['movement', 'disconnect', 'cancel'].includes(failure)) expect(signal.aborted).toBe(true);
});

it.each(['setup', 'scramble', 'correction', 'inspection', 'timed-solve', 'cross-attempt', 'retry'] as const)('refuses generation during active %s', async activity => {
  const { session, deliver } = harness(); await session.connect(); deliver(report());
  session.setActivity(activity);
  const generate = vi.fn();
  await expect(session.startPreparation(generate)).rejects.toThrow('Cancel');
  expect(generate).not.toHaveBeenCalled();
});

it('uses original moves directly from solved without invoking the full-cube solver', async () => {
  const { session, deliver } = harness(); await session.connect(); deliver(report());
  const solver = vi.fn();
  await session.startPreparation(async () => validateScramble('R2 U'), solver);
  expect(session.preparation?.guide?.sequence).toEqual(['R2', 'U']);
  expect(solver).not.toHaveBeenCalled();
});

it('keeps the captured target binding when a caller mutates its generated target during solving', async () => {
  const { session, deliver } = harness(); await session.connect();
  const source = turn(SOLVED, 'F'); deliver(report(10, source));
  const target = validateScramble('R');
  let finish!: (value: { source: string; target: string; moves: string[] }) => void;
  const pending = session.startPreparation(async () => target, () => new Promise(resolve => { finish = resolve; }));
  await Promise.resolve();
  target.target = turn(SOLVED, 'U');
  finish({ source, target: target.target, moves: ["F'", 'U'] });
  await pending;
  expect(session.preparation?.status).toBe('error');
  expect(session.preparation?.scramble?.target).toBe(turn(SOLVED, 'R'));
});

it('prepares arbitrary sources using separately retained setup and preparation-only events', async () => {
  const { session, deliver } = harness(); await session.connect();
  const source = turn(SOLVED, 'F'); deliver(report(10, source));
  const target = validateScramble('R2 U');
  const solver = vi.fn(async () => ({ source, target: target.target, moves: ["F'", 'R2', 'U'] }));
  await session.startPreparation(async () => target, solver);
  expect(solver).toHaveBeenCalledWith(source, { original: target.original, target: target.target }, expect.any(AbortSignal));
  expect(session.preparation?.scramble?.original).toBe('R2 U');
  expect(session.preparation?.guide?.sequence).toEqual(["F'", 'R2', 'U']);
  for (const [i, notation] of ["F'", 'R', 'R', 'U'].entries()) deliver(move(11 + i, notation));
  expect(session.preparation?.status).toBe('ready');
  expect(session.preparation?.guide?.raw).toHaveLength(4);
  expect(session.preparation?.guide?.facelets).toBe(target.target);
  expect(session.activity).toBe('setup');
});

it('prepares a generated target with live undo guidance and guards replacement until cancellation', async () => {
  const { session, deliver } = harness(); await session.connect(); deliver(report());
  await session.startPreparation(async () => validateScramble('R2 U'));
  expect(session.preparation?.status).toBe('preparing');
  expect(session.canReset).toBe(false);
  await expect(session.startPreparation(async () => validateScramble('F'))).rejects.toThrow('Cancel');
  deliver(move(11, 'U')); deliver(move(12, 'F'));
  expect(session.preparation?.guide?.undo).toEqual(["F'", "U'"]);
  for (const [i, notation] of ["F'", "U'", 'R', 'R', 'U'].entries()) deliver(move(13 + i, notation));
  expect(session.preparation?.status).toBe('ready');
  expect(session.preparation?.guide?.facelets).toBe(validateScramble('R2 U').target);
  expect(session.canReset).toBe(false);
  session.cancelPreparation();
  expect(session.activity).toBe('idle');
  expect(session.preparation).toBeNull();
});

it('shows generation errors, rejects movement while loading, and ignores cancelled stale replies', async () => {
  const { session, deliver } = harness(); await session.connect(); deliver(report());
  await session.startPreparation(async () => { throw new Error('Generator unavailable'); });
  expect(session.preparation).toMatchObject({ status: 'error', error: expect.stringContaining('Generator unavailable') });
  session.cancelPreparation();
  let finish!: (scramble: ReturnType<typeof validateScramble>) => void;
  const pending = session.startPreparation(() => new Promise(resolve => { finish = resolve; }));
  expect(session.preparation?.status).toBe('loading');
  deliver(move(11)); deliver(move(12, "R'"));
  finish(validateScramble('F')); await pending;
  expect(session.preparation).toMatchObject({ status: 'error', error: expect.stringContaining('moved') });
  session.cancelPreparation();
  const cancelled = session.startPreparation(() => new Promise(resolve => { finish = resolve; }));
  session.cancelPreparation();
  finish(validateScramble('F')); await cancelled;
  expect(session.preparation).toBeNull();
  await session.startPreparation(async () => validateScramble('U4'));
  expect(session.preparation?.status).toBe('error');
});

it.each(['disconnect', 'duplicate', 'ready movement'])('invalidates preparation on %s without silently replacing its target', async failure => {
  const { session, deliver } = harness(); await session.connect(); deliver(report());
  await session.startPreparation(async () => validateScramble('R'));
  if (failure === 'disconnect') deliver({ type: 'DISCONNECT', timestamp: 1 });
  if (failure === 'duplicate') { deliver(move(11, 'U')); deliver(move(11, 'U')); }
  if (failure === 'recovered') deliver({ ...move(11), localTimestamp: null });
  if (failure === 'ready movement') { deliver(move(11)); deliver(move(12)); }
  expect(session.preparation?.status).toBe('error');
  expect(session.preparation?.scramble?.original).toBe('R');
});

export function harness(clock: () => number = () => 42) {
  let observer: { next(event: GanCubeEvent): void; error(error: unknown): void; complete(): void };
  const request = vi.fn(async () => {});
  const connection: Connection = {
    deviceName: 'GAN16 UI', events$: { subscribe: value => { observer = value; return { unsubscribe: vi.fn() }; } },
    sendCubeCommand: request, disconnect: vi.fn(async () => {}),
  };
  const session = new LiveSession(async () => connection, clock, () => {});
  return { session, request, deliver: (event: GanCubeEvent) => observer.next(event) };
}
export function report(serial = 10, facelets = SOLVED): GanCubeEvent {
  return { type: 'FACELETS', timestamp: 1, serial, facelets, state: { CP: [], CO: [], EP: [], EO: [] } };
}
export function move(serial = 11, notation = 'R'): Extract<GanCubeEvent, { type: 'MOVE' }> {
  return { type: 'MOVE', timestamp: 2, serial, face: 'URFDLB'.indexOf(notation[0]), direction: notation.endsWith("'") ? 1 : 0, move: notation, localTimestamp: 2, cubeTimestamp: 1 };
}
it('resets the gyro reference without changing logical state and tracks subsequent relative rotation', async () => {
  const { session, deliver } = harness(); await session.connect(); deliver(report()); deliver(move());
  const pose = { x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 };
  deliver({ type: 'GYRO', timestamp: 1, quaternion: pose });
  session.resetGyro();
  Object.entries(session.orientation!).forEach(([axis, value]) => expect(value).toBeCloseTo(axis === 'w' ? 1 : 0));
  expect(session.diagnostic.snapshot().facelets).toBe(turn(SOLVED, 'R'));
  deliver({ type: 'GYRO', timestamp: 2, quaternion: { x: 0, y: 0, z: 1, w: 0 } });
  expect(session.orientation?.z).toBeCloseTo(Math.SQRT1_2);
  expect(session.orientation?.w).toBeCloseTo(Math.SQRT1_2);
});
it.each(['setup', 'scramble', 'correction', 'inspection', 'timed-solve', 'cross-attempt', 'retry'] as const)('guards all reset actions during %s, even with a pending confirmation', async activity => {
  const { session, deliver } = harness(); await session.connect(); deliver(report());
  deliver({ type: 'GYRO', timestamp: 1, quaternion: { x: 0, y: 0, z: 0, w: 1 } });
  session.requestSolvedReset();
  session.setActivity(activity);
  expect(session.canReset).toBe(false);
  expect(session.solvedResetPending).toBe(false);
  expect(() => session.resetGyro()).toThrow('idle');
  expect(() => session.requestSolvedReset()).toThrow('idle');
  expect(() => session.confirmPhysicallySolved()).toThrow('idle');
  expect(() => session.synchronize()).toThrow('idle');
  session.setActivity('idle');
  expect(() => session.confirmPhysicallySolved()).toThrow('confirmation');
  session.requestSolvedReset(); session.confirmPhysicallySolved();
  expect(session.canPractice).toBe(true);
});
it('requires an explicit reset request, cancels it, and refuses conflicting unsolved state', async () => {
  const { session, deliver } = harness(); await session.connect(); deliver(report());
  expect(() => session.confirmPhysicallySolved()).toThrow('confirmation');
  session.requestSolvedReset(); session.cancelSolvedReset();
  expect(() => session.confirmPhysicallySolved()).toThrow('confirmation');
  session.requestSolvedReset(); deliver(report(10, turn(SOLVED, 'R')));
  expect(() => session.confirmPhysicallySolved()).toThrow('reported');
  expect(session.diagnostic.snapshot().facelets).toBe(turn(SOLVED, 'R'));
  expect(session.canPractice).toBe(true);
});
it.each(['U', "U'", 'D', "D'"])('recognizes four raw %s quarter turns at the inclusive two-second limit', async notation => {
  let now = 0;
  const { session, deliver } = harness(() => now); await session.connect(); deliver(report());
  deliver({ type: 'GYRO', timestamp: 1, quaternion: { x: 1, y: 0, z: 0, w: 1 } });
  for (let i = 0; i < 4; i++) {
    now = [0, 500, 1000, 2000][i]; deliver(move(11 + i, notation));
    if (i < 3) { expect(session.solvedResetPending).toBe(false); expect(session.orientation?.x).toBe(1); }
  }
  expect(session.diagnostic.snapshot().turns).toHaveLength(4);
  expect(session.diagnostic.snapshot().facelets).toBe(SOLVED);
  if (notation[0] === 'U') expect(session.orientation?.x).toBeCloseTo(0);
  else { expect(session.solvedResetPending).toBe(true); expect(session.orientation?.x).toBe(1); }
});
it('refuses to overwrite a synchronized unsolved device state even after its report was consumed', async () => {
  const { session, deliver } = harness(); await session.connect(); deliver(report(10, turn(SOLVED, 'R')));
  session.requestSolvedReset();
  expect(() => session.confirmPhysicallySolved()).toThrow('reported');
  expect(session.diagnostic.snapshot().facelets).toBe(turn(SOLVED, 'R'));
});
it('invalidates an open solved confirmation on any subsequent physical move', async () => {
  const { session, deliver } = harness(); await session.connect(); deliver(report()); session.requestSolvedReset();
  deliver(move(13)); // A missing serial also invalidates tracking.
  expect(session.solvedResetPending).toBe(false);
  expect(() => session.confirmPhysicallySolved()).toThrow('confirmation');
});
it.each(['direction', 'face', 'timeout', 'backwards clock', 'disconnect', 'stream error', 'stream end', 'tracking loss', 'recovered'] as const)('clears the raw gesture candidate on %s', async reason => {
  let now = 0;
  let observer: { next(event: GanCubeEvent): void; error(error: unknown): void; complete(): void };
  const connection: Connection = { deviceName: 'test', events$: { subscribe: value => { observer = value; return { unsubscribe: () => {} }; } }, sendCubeCommand: async () => {}, disconnect: async () => {} };
  const session = new LiveSession(async () => connection, () => now, () => {});
  await session.connect(); observer!.next(report());
  observer!.next(move(11, 'D')); now = 100; observer!.next(move(12, 'D')); now = 200; observer!.next(move(13, 'D'));
  let serial = 14;
  if (reason === 'direction' || reason === 'face') observer!.next(move(serial++, reason === 'direction' ? "D'" : 'R'));
  if (reason === 'timeout') now = 2001;
  if (reason === 'backwards clock') now = 99;
  if (reason === 'disconnect' || reason === 'stream error' || reason === 'stream end') {
    if (reason === 'disconnect') observer!.next({ type: 'DISCONNECT', timestamp: 1 });
    else if (reason === 'stream error') observer!.error(new Error('lost stream'));
    else observer!.complete();
    await Promise.resolve(); // Let asynchronous stream-error teardown finish.
    await session.connect(); observer!.next(report(13));
  }
  if (reason === 'tracking loss') { observer!.next(report(13)); session.synchronize(); }
  if (reason === 'recovered') {
    observer!.next({ ...move(serial++, 'D'), localTimestamp: null }); observer!.next(report(serial - 1)); session.synchronize();
  }
  observer!.next(move(serial++, 'D'));
  expect(session.solvedResetPending).toBe(false);
  // The boundary event starts a fresh four-event candidate.
  for (let i = 0; i < 3; i++) { now += 100; observer!.next(move(serial++, 'D')); }
  expect(session.solvedResetPending).toBe(true);
  await session.disconnect();
});
it.each(['setup', 'scramble', 'correction', 'inspection', 'timed-solve', 'cross-attempt', 'retry'] as const)('disables both raw shortcuts during %s and clears candidates across idle transitions', async activity => {
  const { session, deliver } = harness(); await session.connect(); deliver(report());
  deliver({ type: 'GYRO', timestamp: 1, quaternion: { x: 1, y: 0, z: 0, w: 1 } });
  let serial = 11;
  for (let i = 0; i < 3; i++) deliver(move(serial++, 'D'));
  session.setActivity(activity);
  for (const notation of ['D', 'U']) for (let i = 0; i < 4; i++) deliver(move(serial++, notation));
  expect(session.solvedResetPending).toBe(false);
  expect(session.orientation?.x).toBe(1);
  session.setActivity('idle'); deliver(move(serial++, 'D'));
  expect(session.solvedResetPending).toBe(false);
  for (let i = 0; i < 3; i++) deliver(move(serial++, 'D'));
  expect(session.solvedResetPending).toBe(true);
  await session.disconnect();
});
it('does not reuse turns after firing a gesture or require a gyro for D4', async () => {
  const { session, deliver } = harness(); await session.connect(); deliver(report());
  for (let serial = 11; serial < 15; serial++) deliver(move(serial, 'D'));
  expect(session.solvedResetPending).toBe(true);
  session.cancelSolvedReset(); deliver(move(15, 'D'));
  expect(session.solvedResetPending).toBe(false);
  await session.disconnect();
});
it('opens solved fallback from four raw D turns while idle with unknown piece state', async () => {
  const { session, deliver } = harness(); await session.connect();
  for (let serial = 11; serial < 15; serial++) deliver(move(serial, 'D'));
  expect(session.solvedResetPending).toBe(true);
  expect(session.diagnostic.snapshot().facelets).toBeNull();
  session.confirmPhysicallySolved();
  expect(session.canPractice).toBe(true);
  await session.disconnect();
});
it('requests device state, synchronizes a validated report and updates each physical turn', async () => {
  const { session, request, deliver } = harness();
  expect(session.canPractice).toBe(false);
  await session.connect();
  expect(request).toHaveBeenCalledWith({ type: 'REQUEST_FACELETS' });
  expect(session.state).toBe('unsynchronized');
  deliver(report());
  expect(session.canPractice).toBe(true);
  deliver(move());
  expect(session.diagnostic.snapshot().facelets).toBe(turn(SOLVED, 'R'));
  expect(session.timingBasis).toContain('performance.now()');
});
it('requests recovery state after the adapter debounce rather than waiting for its periodic report', async () => {
  vi.useFakeTimers();
  try {
    const { session, request, deliver } = harness(); await session.connect(); deliver(report(10)); request.mockClear();
    deliver(move(11, "R'"));
    await vi.advanceTimersByTimeAsync(509);
    expect(request).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(request).toHaveBeenCalledExactlyOnceWith({ type: 'REQUEST_FACELETS' });
    deliver(move(12, 'L'));
    await session.disconnect();
    await vi.advanceTimersByTimeAsync(1000);
    expect(request).toHaveBeenCalledTimes(1);
  } finally { vi.useRealTimers(); }
});
it('coalesces recovery requests during a move burst and never sends an old timer to a new connection', async () => {
  vi.useFakeTimers();
  try {
    const { session, request, deliver } = harness(); await session.connect(); deliver(report(10)); request.mockClear();
    deliver(move(11)); await vi.advanceTimersByTimeAsync(300); deliver(move(12, 'U'));
    await vi.advanceTimersByTimeAsync(300);
    expect(request).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(250);
    expect(request).toHaveBeenCalledTimes(1);
    deliver(move(13));
    await session.disconnect(); await session.connect(); request.mockClear();
    await vi.advanceTimersByTimeAsync(1000);
    expect(request).not.toHaveBeenCalled();
    await session.disconnect();
  } finally { vi.useRealTimers(); }
});
it('requires explicit solved fallback, accepts the first turn baseline and refuses a conflicting report', async () => {
  const { session, deliver } = harness();
  await session.connect();
  expect(session.diagnostic.snapshot().facelets).toBe(null);
  session.requestSolvedReset(); session.confirmPhysicallySolved();
  expect(session.canPractice).toBe(true);
  deliver(move(70));
  expect(session.diagnostic.snapshot().facelets).toBe(turn(SOLVED, 'R'));
  deliver(report(70, turn(SOLVED, 'F')));
  expect(session.canPractice).toBe(true);
  session.requestSolvedReset();
  expect(() => session.confirmPhysicallySolved()).toThrow('reported');
  session.synchronize();
  expect(session.diagnostic.snapshot().facelets).toBe(turn(SOLVED, 'F'));
});
it.each([
  ['duplicate', move(11)], ['gap', move(13)], ['out of order', move(10)],
  ['mismatch', report(11)], ['disconnect', { type: 'DISCONNECT', timestamp: 3 }],
] as [string, GanCubeEvent][])('recovers automatically after %s when fresh state arrives', async (_, event) => {
  const { session, deliver } = harness();
  await session.connect(); deliver(report()); deliver(move()); deliver(event);
  expect(session.canPractice).toBe(event.type === 'FACELETS');
  if (session.status === 'connected') {
    deliver(report(event.type === 'FACELETS' ? 11 : 13));
    expect(session.canPractice).toBe(true);
  } else {
    await session.connect();
    expect(session.canPractice).toBe(false);
    deliver(report(event.type === 'FACELETS' ? 11 : 13));
    expect(session.canPractice).toBe(true);
  }
});
it('keeps M-pair history in the viewer and verifies recovered moves without manual synchronization', async () => {
  const { session, deliver } = harness(); await session.connect(); deliver(report(24, turn(SOLVED, "R'")));
  const middle = turn(turn(SOLVED, "R'"), 'L');
  deliver(report(25, middle));
  deliver({ ...move(25, 'L'), localTimestamp: null, cubeTimestamp: null });
  expect(session.diagnostic.snapshot().facelets).toBe(middle);
  expect(session.canPractice).toBe(true);
  expect(session.diagnostic.snapshot().timingInterruptions).toBe(1);
  expect(session.diagnostic.snapshot().turns.at(-1)).toMatchObject({ move: 'L', recovered: true, deviceMs: null });
  deliver(move(26, 'R'));
  deliver({ ...move(27, "L'"), localTimestamp: null, cubeTimestamp: null });
  expect(session.diagnostic.snapshot().facelets).toBe(SOLVED);
  expect(session.canPractice).toBe(false);
  deliver(report(27));
  expect(session.canPractice).toBe(true);
});
it('tracks repeated M and inverse M pairs across counter rollover with recovered L events', async () => {
  const { session, deliver } = harness(); await session.connect(); deliver(report(250));
  let serial = 250, expected = SOLVED;
  for (const notation of ["R'", 'L', "R'", 'L', "R'", 'L', "R'", 'L', 'R', "L'", 'R', "L'", 'R', "L'", 'R', "L'"]) {
    serial = (serial + 1) % 256;
    expected = turn(expected, notation);
    deliver({ ...move(serial, notation), ...(notation.startsWith('L') ? { localTimestamp: null, cubeTimestamp: null } : {}) });
    deliver(report(serial, expected));
    expect(session.diagnostic.snapshot().facelets).toBe(expected);
    expect(session.canPractice).toBe(true);
  }
  expect(expected).toBe(SOLVED);
  expect(session.diagnostic.snapshot().timingInterruptions).toBe(8);
});
it('automatically reconciles recovered moves contradicted by a report', async () => {
  const { session, deliver } = harness(); await session.connect(); deliver(report(10));
  deliver({ ...move(11, 'L'), localTimestamp: null });
  deliver(report(11));
  expect(session.diagnostic.snapshot().tracking).toBe('tracking');
  expect(session.canPractice).toBe(true);
});
it('ignores callbacks from an old connection after reconnecting and opens only one chooser', async () => {
  const oldEvents: ((event: GanCubeEvent) => void)[] = [];
  const connection: Connection = { deviceName: 'test', events$: { subscribe: observer => { oldEvents.push(observer.next); return { unsubscribe: () => {} }; } }, sendCubeCommand: async () => {}, disconnect: async () => {} };
  const chooser = vi.fn(async () => connection);
  const controller = new LiveSession(chooser, () => 1, () => {});
  await Promise.all([controller.connect(), controller.connect()]);
  expect(chooser).toHaveBeenCalledOnce();
  await controller.disconnect(); await controller.connect();
  oldEvents[0](report());
  expect(controller.canPractice).toBe(false);
  oldEvents[1](report());
  expect(controller.canPractice).toBe(true);
});
it('waits for Bluetooth teardown before opening another chooser', async () => {
  let finish: () => void = () => {};
  const chooser = vi.fn(async (): Promise<Connection> => ({ deviceName: 'test', events$: { subscribe: () => ({ unsubscribe: () => {} }) }, sendCubeCommand: async () => {}, disconnect: () => new Promise<void>(resolve => { finish = resolve; }) }));
  const controller = new LiveSession(chooser, () => 1, () => {});
  await controller.connect();
  const closing = controller.disconnect();
  await controller.connect();
  expect(chooser).toHaveBeenCalledOnce();
  finish(); await closing;
  await controller.connect();
  expect(chooser).toHaveBeenCalledTimes(2);
});
it('rejects malformed report serials instead of enabling practice', async () => {
  const { session, deliver } = harness(); await session.connect();
  deliver(report(Number.NaN));
  expect(session.canPractice).toBe(false);
  expect(session.diagnostic.snapshot().candidate).toBe(null);
});
it('waits for ordered moves when a state report arrives ahead of the move stream', async () => {
  const { session, deliver } = harness(); await session.connect(); deliver(report(45));
  deliver(move(46, "R'"));
  const expected = turn(turn(SOLVED, "R'"), 'L');
  deliver(report(47, expected));
  expect(session.canPractice).toBe(false);
  deliver(move(47, 'L'));
  expect(session.canPractice).toBe(true);
  expect(session.diagnostic.snapshot().facelets).toBe(expected);
  for (let serial = 48; serial <= 53; serial++) deliver(move(serial, serial % 2 === 0 ? "R'" : 'L'));
  expect(session.diagnostic.snapshot().facelets).toBe(SOLVED);
  expect(session.canPractice).toBe(true);
});
it('invalidates unmatched ahead reports and does not conceal missing or recovered moves', async () => {
  const { session, deliver } = harness(); await session.connect(); deliver(report(45));
  deliver(report(46, SOLVED)); deliver(move(46));
  expect(session.diagnostic.snapshot().tracking).toBe('invalid');
  deliver(report(46)); session.synchronize();
  deliver(report(47, turn(SOLVED, 'R')));
  deliver({ type: 'GYRO', timestamp: 3000, quaternion: { x: 0, y: 0, z: 0, w: 1 } });
  // The harness uses a fixed receipt clock; explicit gaps must still invalidate.
  deliver(move(48));
  expect(session.diagnostic.snapshot().tracking).toBe('invalid');
});
it('requires state confirmation for the observed first-move zero counter anomaly', async () => {
  const { session, deliver } = harness(); await session.connect(); deliver(report(0));
  deliver(move(0));
  expect(session.canPractice).toBe(false);
  expect(session.diagnostic.snapshot().facelets).toBe(turn(SOLVED, 'R'));
  deliver(report(0, turn(SOLVED, 'R')));
  expect(session.canPractice).toBe(true);
  deliver(move(1, "R'"));
  expect(session.diagnostic.snapshot().facelets).toBe(SOLVED);
  deliver(move(1));
  expect(session.diagnostic.snapshot().tracking).toBe('invalid');
});
it('expires an ahead report when its moves never arrive', async () => {
  let now = 0;
  let deliver: (event: GanCubeEvent) => void = () => {};
  const connection: Connection = { deviceName: 'test', events$: { subscribe: observer => { deliver = observer.next; return { unsubscribe: () => {} }; } }, sendCubeCommand: async () => {}, disconnect: async () => {} };
  const session = new LiveSession(async () => connection, () => now, () => {});
  await session.connect(); deliver(report(10)); deliver(report(11, turn(SOLVED, 'R')));
  expect(session.canPractice).toBe(false);
  now = 2001; deliver({ type: 'GYRO', timestamp: 2001, quaternion: { x: 0, y: 0, z: 0, w: 1 } });
  expect(session.diagnostic.snapshot().tracking).toBe('invalid');
  deliver(move(11));
  expect(session.canPractice).toBe(false);
});

it('times first physical turn after setup, ignores gyro, and saves once after solved', async () => {
  let now = 0; const { session, deliver } = harness(() => now);
  await session.connect(); deliver(report());
  const save = vi.fn(async (_result: import('../domain/timed-attempt').TimedResult) => { void _result; });
  await session.startTimedPreparation('selected-session', true, save, async () => validateScramble('R2'));
  now = 100; deliver(move(11)); now = 200; deliver(move(12));
  expect(session.timed?.phase).toBe('inspection'); expect(save).not.toHaveBeenCalled();
  now = 15200; deliver({ type: 'GYRO', timestamp: 1, quaternion: { x: 0, y: 0, z: 0, w: 1 } });
  expect(session.timed?.phase).toBe('inspection');
  deliver(move(13, "R'")); expect(session.timed?.phase).toBe('active');
  now = 16434.567; deliver(move(14, "R'")); await Promise.resolve();
  await vi.waitFor(() => expect(session.timed?.saveState).toBe('saved'));
  expect(save).toHaveBeenCalledTimes(1);
  expect(save.mock.calls[0][0]).toMatchObject({ sessionId: 'selected-session', penalty: '+2', rawDurationMs: 1234.566999999999 });
  expect(save.mock.calls[0][0].rawTurns).toMatchObject([{ move: "R'", serial: 13 }, { move: "R'", serial: 14 }]);
  expect(save.mock.calls[0][0].rawTurns).toHaveLength(2);
  expect(save.mock.calls[0][0].facelets).toBe(SOLVED);
  deliver(report(14)); deliver(move(14, "R'"));
  expect(save).toHaveBeenCalledTimes(1);
});
it('shows failed storage instead of success and retains the completed result', async () => {
  const { session, deliver } = harness(); await session.connect(); deliver(report());
  await session.startTimedPreparation('s', false, async () => { throw new Error('Quota exceeded'); }, async () => validateScramble('R'));
  deliver(move(11)); deliver(move(12, "R'")); await Promise.resolve(); await Promise.resolve();
  await vi.waitFor(() => expect(session.timed).toMatchObject({ phase: 'completed', saveState: 'failed', error: expect.stringContaining('Quota exceeded') }));
});


it('never times a canceled ready attempt or a failed setup', async () => {
  const { session, deliver } = harness(); await session.connect(); deliver(report());
  const save = vi.fn(async () => {});
  await session.startTimedPreparation('s', true, save, async () => validateScramble('R'));
  deliver(move(11)); session.cancelPreparation(); deliver(move(12, "R'"));
  expect(session.timed).toBeNull(); expect(save).not.toHaveBeenCalled();
  await session.startTimedPreparation('s', false, save, async () => { throw new Error('Unavailable'); });
  deliver(move(13)); deliver(move(14, "R'"));
  expect(session.preparation?.status).toBe('error'); expect(save).not.toHaveBeenCalled();
});
it('arms matching targets using the same host clock and stores wall start independently', async () => {
  let now = 10; let wall = 123;
  let deliver!: (event: GanCubeEvent) => void;
  const connection: Connection = { deviceName: 'test', events$: { subscribe: observer => { deliver = observer.next; return { unsubscribe: () => {} }; } }, sendCubeCommand: async () => {}, disconnect: async () => {} };
  const session = new LiveSession(async () => connection, () => now, () => {}, () => wall);
  await session.connect(); deliver(report(10, validateScramble('R2').target));
  const save = vi.fn(async (_result: import('../domain/timed-attempt').TimedResult) => { void _result; });
  await session.startTimedPreparation('bound-session', true, save, async () => validateScramble('R2'));
  now = 17010; deliver(move(11, "R'")); wall = -999999; now = 18010.125; deliver(move(12, "R'"));
  await vi.waitFor(() => expect(session.timed?.saveState).toBe('saved'));
  expect(save.mock.calls[0][0]).toMatchObject({ startedAt: 123, rawDurationMs: 1000.125, penalty: 'dnf', timingBasis: 'host-monotonic-receipt' });
});

it.each(['inspection', 'active'] as const)('keeps %s running across disconnect and automatically restores state', async stage => {
  let now = 0; const { session, deliver } = harness(() => now); await session.connect(); deliver(report());
  const save = vi.fn(async () => {});
  await session.startTimedPreparation('s', true, save, async () => validateScramble('R2'));
  deliver(move(11)); deliver(move(12));
  if (stage === 'active') { now = 100; deliver(move(13, "R'")); }
  now = 350; deliver({ type: 'DISCONNECT', timestamp: 1 });
  expect(save).not.toHaveBeenCalled();
  expect(session.timed?.phase).toBe(stage);
  await session.connect(); deliver(report(20, turn(SOLVED, "R'")));
  expect(session.canPractice).toBe(true);
  now = 1000; deliver(move(21));
  await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(session.timed?.result?.status).toBe('completed');
});
it('active cancel saves DNF and a recovered solve-ending turn saves completion even when its report matches', async () => {
  const { session, deliver } = harness(); await session.connect(); deliver(report());
  const save = vi.fn(async (_result: import('../domain/timed-attempt').TimedResult) => { void _result; });
  await session.startTimedPreparation('s', false, save, async () => validateScramble('R2'));
  deliver(move(11)); deliver(move(12)); deliver(move(13, "R'")); session.cancelPreparation();
  await vi.waitFor(() => expect(session.timed?.saveState).toBe('saved'));
  expect(save.mock.calls[0][0]).toMatchObject({ status: 'completed', penalty: 'dnf' });
  session.cancelPreparation();
  await session.startTimedPreparation('s', false, save, async () => validateScramble('R2'), async source => ({ source, target: validateScramble('R2').target, moves: ['R'] }));
  deliver(move(14)); deliver(move(15, "R'")); deliver(report(16)); deliver({ ...move(16, "R'"), localTimestamp: null });
  await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[1][0]).toMatchObject({ status: 'completed', penalty: 'none' });
  expect(session.canPractice).toBe(true);
});

it('retains a failed cancellation checkpoint until an explicit cleanup retry', async () => {
  const { session, deliver } = harness(); await session.connect(); deliver(report());
  const clear = vi.fn().mockRejectedValueOnce(new Error('Disk failed')).mockResolvedValue(undefined);
  const checkpoint = vi.fn(async () => {}); const save = vi.fn(async () => {});
  await session.startTimedPreparation('s', false, save, async () => validateScramble('R2'), undefined, { checkpoint, clear });
  session.cancelPreparation();
  await vi.waitFor(() => expect(session.timed).toMatchObject({ phase: 'canceled', saveState: 'failed' }));
  expect(save).not.toHaveBeenCalled(); expect(clear).toHaveBeenCalledTimes(1);
  session.cancelPreparation();
  await vi.waitFor(() => expect(session.timed).toBeNull());
  expect(clear).toHaveBeenCalledTimes(2); expect(save).not.toHaveBeenCalled();
});
it('initial checkpoint failure interrupts visibly without invoking generation, and blocks reset while reserving', async () => {
  const { session, deliver } = harness(); await session.connect(); deliver(report());
  const generate = vi.fn(async () => validateScramble('R2'));
  let reject!: (error: Error) => void;
  const checkpoint = vi.fn(() => new Promise<void>((_resolve, fail) => { reject = fail; }));
  const save = vi.fn(async (_result: import('../domain/timed-attempt').TimedResult) => { void _result; });
  const pending = session.startTimedPreparation('s', false, save, generate, undefined, { checkpoint, clear: async () => {} });
  expect(session.canReset).toBe(false);
  await Promise.resolve(); reject(new Error('Quota exceeded')); await pending;
  await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(generate).not.toHaveBeenCalled();
  expect(session.timed?.checkpointError).toContain('Quota exceeded');
  expect(save.mock.calls[0][0]).toMatchObject({ status: 'interrupted', interruptionPhase: 'setup', solveStarted: false });
  expect(session.canPractice).toBe(false);
});
it.each(['duplicate', 'gap', 'out of order', 'mismatch'] as const)('preserves the attempt after %s and completes once tracking recovers', async failure => {
  const { session, deliver } = harness(); await session.connect(); deliver(report());
  const save = vi.fn(async (_result: import('../domain/timed-attempt').TimedResult) => { void _result; });
  await session.startTimedPreparation('s', false, save, async () => validateScramble('R2'));
  deliver(move(11)); deliver(move(12)); deliver(move(13, "R'"));
  if (failure === 'mismatch') deliver(report(13));
  else deliver(move(failure === 'duplicate' ? 13 : failure === 'gap' ? 15 : 12, "R'"));
  deliver(move(14, "R'")); deliver(report(14));
  await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(save.mock.calls[0][0]).toMatchObject({ status: 'completed' });
  expect(session.canPractice).toBe(true);
});

it.each(['disconnect', 'movement'] as const)('interrupts %s during the initial checkpoint reservation and never starts stale preparation', async failure => {
  const { session, deliver } = harness(); await session.connect(); deliver(report());
  let finish!: () => void;
  const checkpoint = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  const save = vi.fn(async (_result: import('../domain/timed-attempt').TimedResult) => { void _result; });
  const generate = vi.fn(async () => validateScramble('R2'));
  const pending = session.startTimedPreparation('s', false, save, generate, undefined, { checkpoint, clear: async () => {} });
  await Promise.resolve();
  if (failure === 'disconnect') deliver({ type: 'DISCONNECT', timestamp: 1 });
  else deliver(move(11));
  finish(); await pending;
  await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(generate).not.toHaveBeenCalled(); expect(session.timed?.phase).toBe('interrupted');
  expect(session.preparation?.status).toBe('error');
  expect(session.canPractice).toBe(false);
});

it('keeps active solve timing through a checkpoint failure and saves the final result', async () => {
  let now = 0; const { session, deliver } = harness(() => now); await session.connect(); deliver(report());
  const checkpoint = vi.fn(async () => {});
  const save = vi.fn(async () => {});
  await session.startTimedPreparation('s', false, save, async () => validateScramble('R2'), undefined, { checkpoint, clear: async () => {} });
  deliver(move(11)); deliver(move(12)); now = 100; deliver(move(13, "R'"));
  await vi.waitFor(() => expect(checkpoint).toHaveBeenCalledTimes(5));
  checkpoint.mockRejectedValueOnce(new Error('Temporary storage failure'));
  session.checkpointActiveAttempt();
  await vi.waitFor(() => expect(session.timed?.checkpointError).toContain('Temporary storage failure'));
  expect(session.timed?.phase).toBe('active'); expect(save).not.toHaveBeenCalled();
  now = 1100; deliver({ ...move(14, "R'"), localTimestamp: null, cubeTimestamp: null });
  await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(session.timed?.result).toMatchObject({ status: 'completed', rawDurationMs: 1000, originalScramble: 'R2' });
});

