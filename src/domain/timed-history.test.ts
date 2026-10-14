import { expect, it } from 'vitest';
import { effectiveTime, eligibleTimedResult } from './timed-history';
import type { TimedResult } from './timed-attempt';
const result: TimedResult = { id: 'id', sessionId: 's', status: 'completed', startedAt: 0, rawDurationMs: 1234.567, penalty: '+2', timingBasis: 'host-monotonic-receipt' };
it('uses unrounded raw precision and excludes DNF and interrupted records numerically', () => {
  expect(effectiveTime(result)).toBe(3234.567); expect(eligibleTimedResult(result)).toBe(true);
  expect(effectiveTime({ ...result, penalty: 'dnf' })).toBeNull();
  expect(eligibleTimedResult({ ...result, penalty: 'dnf' })).toBe(false);
  expect(effectiveTime({ ...result, status: 'interrupted' })).toBeNull();
  expect(eligibleTimedResult({ ...result, status: 'interrupted' })).toBe(false);
});
