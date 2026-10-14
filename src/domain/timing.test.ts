import { expect, it } from 'vitest';
import { measureTiming } from './timing';
import type { TraceEntry } from './diagnostic';

it('compares clock intervals without treating device timestamps as calibrated time', () => {
  const entries: TraceEntry[] = [0, 1, 2].map(i => ({
    receivedHostMs: 10 + i * 20,
    event: { type: 'MOVE', timestamp: 1000+i, serial: i, face: 0, direction: 0, move: 'U', localTimestamp: i === 2 ? null : 1000+i, cubeTimestamp: i === 2 ? null : i * 10 },
  }));
  expect(measureTiming(entries)).toEqual({
    moveCount: 3, recoveredCount: 1, hostSpanMs: 40,
    intervals: [{ hostMs: 20, deviceMs: 10, differenceMs: 10 }, { hostMs: 20, deviceMs: null, differenceMs: null }],
  });
});
