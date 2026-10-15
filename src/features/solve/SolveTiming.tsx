import type { LiveSession } from '../../app/live-session';
import { formatSolveTime } from '../../domain/timed-attempt';
import { Button } from '../../components/ui/button';
import { CFOPBreakdown } from './CFOPBreakdown';
export function SolveTiming({ session }: { session: LiveSession }) {
  const timed = session.timed;
  const showPrevious = !timed || timed.phase === 'setup' || timed.phase === 'ready';
  const result = timed?.result ?? (showPrevious ? session.previousSolve : null);
  const value = result ? formatSolveTime(result) : ((timed?.elapsedMs ?? 0) / 1000).toFixed(2);
  return <div className="timing-feedback" role="region" aria-label="Automatic solve timing">
    <p className="timer-value" role={timed?.phase === 'active' ? 'timer' : undefined} aria-label={timed?.phase === 'inspection' ? 'Inspection time' : 'Solve time'}>{value}</p>
    {timed?.phase === 'inspection' && <p>Inspection</p>}
    {timed?.result?.status === 'completed' && <p>Completed{timed.saveState === 'pending' ? ' · Saving…' : ''}</p>}
    {timed?.result?.status === 'interrupted' && <p role="status">Interrupted: {timed.result.reason}.</p>}
    {timed?.saveState === 'failed' && <p role="alert">Result was not saved. {timed.error} <Button onClick={() => session.retrySave()}>Retry save</Button></p>}
    {timed?.checkpointError && <p role="alert">{timed.checkpointError}</p>}
    {result && <CFOPBreakdown result={result} />}
  </div>;
}
