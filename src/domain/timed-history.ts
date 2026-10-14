import type { TimedResult } from './timed-attempt';
export function eligibleTimedResult(result: TimedResult): boolean {
  return result.status === 'completed' && result.penalty !== 'dnf';
}
/** Numeric consumers use stored precision, never rounded display values. */
export function effectiveTime(result: TimedResult): number | null {
  return eligibleTimedResult(result) ? result.rawDurationMs + (result.penalty === '+2' ? 2000 : 0) : null;
}
