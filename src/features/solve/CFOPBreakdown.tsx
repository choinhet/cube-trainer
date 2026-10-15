import { useState } from 'react';
import { analyzeCFOP } from '../../domain/cfop-analysis';
import type { TimedResult } from '../../domain/timed-attempt';
import { analyzeF2LPairs } from '../../domain/cfop-pairs';
import { analyzeLLAlgorithms } from '../../domain/cfop-algorithms';

export function CFOPBreakdown({ result }: { result: TimedResult }) {
  const [selected, setSelected] = useState<string | null>(null);
  if (result.status !== 'completed') return null;
  const analysis = analyzeCFOP(result);
  if (!analysis) return <p className="cfop-unavailable">Detailed timing unavailable</p>;
  const pairs = analyzeF2LPairs(result, analysis);
  const algorithms = analyzeLLAlgorithms(result, analysis);
  const cases = [...pairs, ...algorithms];
  const segments = analysis.phases.flatMap(phase => phase.phase !== 'Cross' ? cases.filter(detail => detail.phase === phase.phase).flatMap(detail => [{ id: `${detail.id}-recognition`, label: `${detail.label} recognition`, phase: detail.phase.toLowerCase(), kind: 'recognition', durationMs: detail.recognitionMs }, { id: `${detail.id}-execution`, label: `${detail.label} execution`, phase: detail.phase.toLowerCase(), kind: 'execution', durationMs: detail.executionMs }]) : [{ id: phase.phase, label: phase.phase, phase: phase.phase.toLowerCase(), kind: 'execution', durationMs: phase.durationMs }]);
  return <section className="cfop-breakdown" aria-label="CFOP phase timing">
    <p>CFOP · {analysis.crossColor} Cross</p>
    <div className="cfop-bar" aria-label="Phase timing bar">
      {analysis.phases.filter(phase => phase.durationMs > 0).map(phase => <div role="group" aria-label={`${phase.phase} phase`} className="cfop-phase-group" key={phase.phase} style={{ flexGrow: phase.durationMs }}>{segments.filter(segment => segment.phase === phase.phase.toLowerCase() && segment.durationMs > 0).map(segment => <button type="button" key={segment.id} className={`cfop-segment cfop-${segment.phase} cfop-${segment.kind}`} style={{ flexGrow: segment.durationMs }} title={`${segment.label}: ${segment.durationMs / 1000} s`} aria-label={`${segment.label}: ${segment.durationMs / 1000} seconds`} aria-pressed={selected === segment.id} onClick={() => setSelected(segment.id)} onFocus={() => setSelected(segment.id)}>{segment.phase === 'f2l' ? 'F2L' : segment.label}</button>)}</div>)}
    </div>
    <dl className="cfop-times">{analysis.phases.map(phase => <div key={phase.phase}><dt>{phase.phase}</dt><dd>{phase.durationMs / 1000} s</dd></div>)}</dl>
    {segments.filter(segment => segment.id === selected).map(segment => <p role="status" key={segment.id}>{segment.label}: {segment.durationMs / 1000} s · {segment.kind === 'recognition' ? 'Recognition' : 'Execution'}</p>)}
    <details className="cfop-case-details"><summary>F2L pair details</summary><ol>{pairs.map(pair => <li key={pair.id}><strong>{pair.label}</strong><span>Recognition: {pair.recognitionMs / 1000} s</span><span>Execution: {pair.executionMs / 1000} s</span></li>)}</ol></details>
    {algorithms.length > 0 && <details className="cfop-case-details"><summary>Algorithm details</summary><ol>{algorithms.map(algorithm => <li key={algorithm.id}><strong>{algorithm.label}</strong><span>Recognition: {algorithm.recognitionMs / 1000} s</span><span>Execution: {algorithm.executionMs / 1000} s</span></li>)}</ol></details>}
  </section>;
}

