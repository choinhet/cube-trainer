/** Physical face-turn events per raw second, never penalty-adjusted duration. */
export function resultTPS(status: string, durationMs: number, turns?: readonly { move: string }[]): string {
  if (status !== 'completed' || !turns?.length || !Number.isFinite(durationMs) || durationMs <= 0 || turns.some(turn => !/^[URFDLB](2|')?$/.test(turn.move))) return '—';
  return (turns.length / (durationMs / 1000)).toFixed(2);
}
