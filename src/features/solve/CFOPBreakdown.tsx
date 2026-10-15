import { useState } from 'react';
import { analyzeCFOP } from '../../domain/cfop-analysis';
import type { TimedResult } from '../../domain/timed-attempt';

export function CFOPBreakdown({ result }: { result: TimedResult }) {
  const [selected, setSelected] = useState<string | null>(null);
  if (result.status !== 'completed') return null;
  const analysis = analyzeCFOP(result);
  if (!analysis) return <p className="cfop-unavailable">Detailed timing unavailable</p>;
  return <section className="cfop-breakdown" aria-label="CFOP phase timing">
    <p>CFOP · {analysis.crossColor} Cross</p>
    <div className="cfop-bar" aria-label="Phase timing bar">
      {analysis.phases.filter(phase => phase.durationMs > 0).map(phase => <button type="button" key={phase.phase} className={`cfop-segment cfop-${phase.phase.toLowerCase()}`} style={{ flexGrow: phase.durationMs }} title={`${phase.phase}: ${phase.durationMs / 1000} s`} aria-label={`${phase.phase}: ${phase.durationMs / 1000} seconds`} aria-pressed={selected === phase.phase} onClick={() => setSelected(selected === phase.phase ? null : phase.phase)} onFocus={() => setSelected(phase.phase)}>{phase.phase}</button>)}
    </div>
    <dl className="cfop-times">{analysis.phases.map(phase => <div key={phase.phase}><dt>{phase.phase}</dt><dd>{phase.durationMs / 1000} s</dd></div>)}</dl>
    {selected && <p role="status">{selected}: {analysis.phases.find(phase => phase.phase === selected)!.durationMs / 1000} s · {selected === 'Cross' ? 'Execution' : 'Phase total'}</p>}
  </section>;
}
