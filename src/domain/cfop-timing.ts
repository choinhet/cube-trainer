import type { TimedResult } from './timed-attempt';

export interface ReconstructedTiming {
  version: 1;
  moveTimesMs: number[];
  sources: ('host' | 'device' | 'order')[];
}
/** Device spacing only allocates time within host anchors; it never sets the total. */
export function reconstructMoveTiming(result: TimedResult): ReconstructedTiming | null {
  const moves = result.rawTurns;
  if (!moves?.length) return null;
  // Legacy records lack an explicit origin: use the first receipt when present,
  // otherwise bound the trace by its final receipt and the preserved raw interval.
  const deviceOnly = !moves.some(move => Number.isFinite(move.hostMs)) && moves.every((move, index) => move.deviceMs !== null && Number.isFinite(move.deviceMs) && (index === 0 || move.deviceMs >= moves[index - 1].deviceMs!)) && moves.at(-1)!.deviceMs! > moves[0].deviceMs!;
  let origin = result.solveStartHostMs ?? (Number.isFinite(moves[0].hostMs) ? moves[0].hostMs : Number.isFinite(moves.at(-1)!.hostMs) ? moves.at(-1)!.hostMs - result.rawDurationMs : NaN);
  if (!Number.isFinite(origin) && result.solveStartHostMs === undefined) {
    const anchors = moves.flatMap((move, index) => Number.isFinite(move.hostMs) && !move.recovered ? [{ index, hostMs: move.hostMs }] : []);
    if (anchors.length) {
      const first = anchors[0], last = anchors.at(-1)!;
      const span = last.hostMs - first.hostMs;
      if (span < 0 || span > result.rawDurationMs) return null;
      // Split unanchored margins by physical order, retaining the exact interior span.
      const margin = result.rawDurationMs - span;
      origin = first.hostMs - margin * first.index / (first.index + moves.length - 1 - last.index);
    } else if (deviceOnly) origin = 0;
  }
  if (!Number.isFinite(origin)) return null;
  const moveTimesMs = moves.map((move, index) => Number.isFinite(move.hostMs) && (!move.recovered || index === 0) ? move.hostMs - origin : NaN);
  const sources: ReconstructedTiming['sources'] = moves.map((move, index) => Number.isFinite(move.hostMs) && (!move.recovered || index === 0) ? 'host' : 'order');
  moveTimesMs[0] = 0;
  if (!Number.isFinite(moveTimesMs.at(-1))) {
    const receipt = moves.at(-1)!.hostMs;
    moveTimesMs[moves.length - 1] = Number.isFinite(receipt) ? Math.min(result.rawDurationMs, receipt - origin) : result.rawDurationMs;
  }
  for (let left = 0; left < moves.length - 1;) {
    let right = left + 1;
    while (right < moves.length && !Number.isFinite(moveTimesMs[right])) right++;
    if (right === moves.length) return null;
    const start = moveTimesMs[left], end = moveTimesMs[right];
    if (end < start || end > result.rawDurationMs) return null;
    const deviceStart = moves[left].deviceMs, deviceEnd = moves[right].deviceMs;
    const device = deviceStart !== null && deviceEnd !== null && Number.isFinite(deviceStart) && Number.isFinite(deviceEnd) && deviceEnd > deviceStart && moves.slice(left, right + 1).every((move, index, all) => move.deviceMs !== null && Number.isFinite(move.deviceMs) && (index === 0 || move.deviceMs >= all[index - 1].deviceMs!));
    for (let index = left + 1; index < right; index++) {
      const fraction = device ? (moves[index].deviceMs! - deviceStart!) / (deviceEnd! - deviceStart!) : (index - left) / (right - left);
      const receipt = Number.isFinite(moves[index].hostMs) ? moves[index].hostMs - origin : end;
      if (receipt < start) return null;
      moveTimesMs[index] = Math.min(receipt, start + (end - start) * fraction);
      sources[index] = device ? 'device' : 'order';
    }
    for (let index = right - 1; index > left; index--) moveTimesMs[index] = Math.min(moveTimesMs[index], moveTimesMs[index + 1]);
    left = right;
  }
  if (moveTimesMs.at(-1)! > result.rawDurationMs) return null;
  return { version: 1, moveTimesMs, sources };
}
