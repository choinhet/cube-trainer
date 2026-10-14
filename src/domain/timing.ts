import type { TraceEntry } from './diagnostic';

export function measureTiming(entries: TraceEntry[]) {
  const moves = entries.filter(entry => entry.event.type === 'MOVE');
  const intervals = moves.slice(1).map((entry, index) => {
    const previous = moves[index];
    const hostMs = entry.receivedHostMs - previous.receivedHostMs;
    const currentDevice = entry.event.type === 'MOVE' ? entry.event.cubeTimestamp : null;
    const previousDevice = previous.event.type === 'MOVE' ? previous.event.cubeTimestamp : null;
    const deviceMs = currentDevice !== null && previousDevice !== null ? currentDevice - previousDevice : null;
    return { hostMs, deviceMs, differenceMs: deviceMs === null ? null : hostMs - deviceMs };
  });
  return {
    moveCount: moves.length,
    recoveredCount: moves.filter(entry => entry.event.type === 'MOVE' && entry.event.localTimestamp === null).length,
    hostSpanMs: moves.length > 1 ? moves.at(-1)!.receivedHostMs - moves[0].receivedHostMs : null,
    intervals,
  };
}
