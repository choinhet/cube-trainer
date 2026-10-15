import { useState } from 'react';
import { analyzeCFOP } from '../../domain/cfop-analysis';
import type { TimedResult } from '../../domain/timed-attempt';
import { analyzeF2LPairs } from '../../domain/cfop-pairs';

export function CFOPBreakdown({ result }: { result: TimedResult }) {
  const [selected, setSelected] = useState<string | null>(null);
  if (result.status !== 'completed') return null;
  const analysis = analyzeCFOP(result);
  if (!analysis) return <p className="cfop-unavailable">Detailed timing unavailable</p>;
  const pairs = analyzeF2LPairs(result, analysis);
  const segments = analysis.phases.flatMap(phase => phase.phase === 'F2L' ? pairs.flatMap(pair => [{ id: `${pair.id}-recognition`, label: `${pair.label} recognition`, phase: 'f2l', kind: 'recognition', durationMs: pair.recognitionMs }, { id: `${pair.id}-execution`, label: `${pair.label} execution`, phase: 'f2l', kind: 'execution', durationMs: pair.executionMs }]) : [{ id: phase.phase, label: phase.phase, phase: phase.phase.toLowerCase(), kind: 'execution', durationMs: phase.durationMs }]);
  return <section className="cfop-breakdown" aria-label="CFOP phase timing">
    <p>CFOP · {analysis.crossColor} Cross</p>
    <div className="cfop-bar" aria-label="Phase timing bar">
      {segments.filter(segment => segment.durationMs > 0).map(segment => <button type="button" key={segment.id} className={`cfop-segment cfop-${segment.phase} cfop-${segment.kind}`} style={{ flexGrow: segment.durationMs }} title={`${segment.label}: ${segment.durationMs / 1000} s`} aria-label={`${segment.label}: ${segment.durationMs / 1000} seconds`} aria-pressed={selected === segment.id} onClick={() => setSelected(segment.id)} onFocus={() => setSelected(segment.id)}>{segment.phase === 'f2l' ? 'F2L' : segment.label}</button>)}
    </div>
    <dl className="cfop-times">{analysis.phases.map(phase => <div key={phase.phase}><dt>{phase.phase}</dt><dd>{phase.durationMs / 1000} s</dd></div>)}</dl>
    {segments.filter(segment => segment.id === selected).map(segment => <p role="status" key={segment.id}>{segment.label}: {segment.durationMs / 1000} s · {segment.kind === 'recognition' ? 'Recognition' : 'Execution'}</p>)}
    <details className="cfop-case-details"><summary>F2L pair details</summary><ol>{pairs.map(pair => <li key={pair.id}><strong>{pair.label}</strong><span>Recognition: {pair.recognitionMs / 1000} s</span><span>Execution: {pair.executionMs / 1000} s</span></li>)}</ol></details>
  </section>;
}

