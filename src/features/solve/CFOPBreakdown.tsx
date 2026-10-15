import { useMemo, useState } from 'react';
import { analyzeCFOP } from '../../domain/cfop-analysis';
import type { TimedResult } from '../../domain/timed-attempt';
import { analyzeF2LPairs } from '../../domain/cfop-pairs';
import { analyzeLLAlgorithms } from '../../domain/cfop-algorithms';
import { CrossSolver, type CrossColor } from '../../domain/cross';
import { countExecutedMoves } from '../../domain/cross-guidance';
import { LLCaseIcon } from './LLCaseIcon';

const solvers = new Map<CrossColor, CrossSolver>();
const seconds = (ms: number) => (ms / 1000).toFixed(2);
const percent = (part: number, total: number) => `${(total > 0 ? part / total * 100 : 0).toFixed(2)}%`;

export function CFOPBreakdown({ result }: { result: TimedResult }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [cardPosition, setCardPosition] = useState({ center: 0, top: 0 });
  function showCard(key: string, element: HTMLElement) {
    const section = element.closest('.cfop-breakdown')!.getBoundingClientRect();
    const target = element.getBoundingClientRect();
    setCardPosition({ center: target.left + target.width / 2 - section.left, top: target.bottom - section.top + 8 });
    setSelected(key);
  }
  const data = useMemo(() => {
    const analysis = analyzeCFOP(result);
    if (!analysis) return null;
    const pairs = analyzeF2LPairs(result, analysis);
    const algorithms = analyzeLLAlgorithms(result, analysis);
    let solver = solvers.get(analysis.crossColor);
    if (!solver) { solver = new CrossSolver(analysis.crossColor); solvers.set(analysis.crossColor, solver); }
    const optimum = solver.distance(analysis.states[0]);
    const cross = analysis.phases[0];
    const steps = [{ id: 'cross', label: 'Cross', executionNote: undefined, phase: 'Cross', startIndex: 0, endIndex: cross.endIndex, startMs: 0, endMs: cross.endMs, recognitionMs: 0, executionMs: cross.durationMs }, ...pairs, ...algorithms].map(step => {
      const siblings = algorithms.filter(item => item.phase === step.phase);
      const shortLabel = step.phase === 'F2L' ? step.label.replace('F2L pair ', 'F2L ') : siblings.length > 1 ? `${step.phase} ${siblings.findIndex(item => item.id === step.id) + 1}` : step.phase;
      // Physical half turns count once; inverse turns and corrections are retained.
      const moves = result.rawTurns!.slice(step.startIndex, step.endIndex);
      const turns = countExecutedMoves(moves.map(move => move.move));
      return { ...step, shortLabel, turns, durationMs: step.endMs - step.startMs };
    });
    return { analysis, steps, optimum };
  }, [result]);
  if (result.status !== 'completed') return null;
  if (!data) return <p className="cfop-unavailable">Detailed timing unavailable</p>;
  const { analysis, steps, optimum } = data;
  const crossMoves = `${optimum} optimal / ${steps[0].turns} executed cross moves`;
  const segments = steps.flatMap(step => (['recognition', 'execution'] as const).map(kind => ({ ...step, kind, key: `${step.id}-${kind}`, ms: kind === 'recognition' ? step.recognitionMs : step.executionMs })));
  const active = segments.find(segment => segment.key === selected);
  const recognition = steps.reduce((sum, step) => sum + step.recognitionMs, 0);
  const turns = steps.reduce((sum, step) => sum + step.turns, 0);
  const total = result.rawDurationMs;
  const metrics = [
    { label: 'Recognition', values: steps.map(step => step.phase === 'Cross' ? '—' : seconds(step.recognitionMs)), total: `${seconds(recognition)} (${percent(recognition, total)})` },
    { label: 'Execution', values: steps.map(step => seconds(step.executionMs)), total: `${seconds(total - recognition)} (${percent(total - recognition, total)})` },
    { label: 'Step time', values: steps.map(step => `${seconds(step.durationMs)} (${percent(step.durationMs, total)})`), total: seconds(total) },
    { label: 'Total time', values: steps.map(step => seconds(step.endMs)), total: seconds(total) },
    { label: 'Turns', values: steps.map(step => String(step.turns)), total: String(turns) },
    { label: 'TPS', values: steps.map(step => (step.durationMs > 0 ? step.turns * 1000 / step.durationMs : 0).toFixed(2)), total: (total > 0 ? turns * 1000 / total : 0).toFixed(2) },
  ];
  return <section className="cfop-breakdown" aria-label="CFOP phase timing">
    <p>{analysis.crossColor[0].toUpperCase() + analysis.crossColor.slice(1)} Cross (CFOP)</p>
    <div className="cfop-bar" aria-label="Phase timing bar" onMouseLeave={() => setSelected(null)}>
      {analysis.phases.filter(phase => phase.durationMs > 0).map(phase => <div role="group" aria-label={`${phase.phase} phase`} className="cfop-phase-group" key={phase.phase} style={{ flexGrow: phase.durationMs }}>{segments.filter(segment => segment.phase === phase.phase && segment.ms > 0).map(segment => <button type="button" key={segment.key} className={`cfop-segment cfop-${segment.phase.toLowerCase()} cfop-${segment.kind}`} style={{ flexGrow: segment.ms }} aria-label={`${segment.label} ${segment.kind}: ${seconds(segment.ms)} seconds`} aria-pressed={selected === segment.key} onClick={() => setSelected(segment.key)} onMouseEnter={event => showCard(segment.key, event.currentTarget)} onFocus={event => showCard(segment.key, event.currentTarget)} onBlur={() => setSelected(null)}>{segment.kind === 'execution' && <span className="cfop-bar-label">{segment.shortLabel}</span>}</button>)}</div>)}

    </div>
    <dl className="cfop-times">{analysis.phases.map(phase => <div key={phase.phase}><dt>{phase.phase}</dt><dd>{seconds(phase.durationMs)} s ({percent(phase.durationMs, total)})</dd></div>)}</dl>

    <div className="cfop-table-scroll"><table className="cfop-analysis-table" aria-label="Step analysis"><thead><tr><th scope="col">Step analysis</th>{steps.map(step => <th scope="col" key={step.id} tabIndex={0} onMouseEnter={event => showCard(`${step.id}-execution`, event.currentTarget)} onMouseLeave={() => setSelected(null)} onFocus={event => showCard(`${step.id}-execution`, event.currentTarget)} onBlur={() => setSelected(null)}>{step.shortLabel}<small>{step.label !== step.shortLabel ? step.label : ''}</small>{step.executionNote && <small className="cfop-execution-note">{step.executionNote}</small>}</th>)}<th scope="col">Total</th></tr></thead><tbody>{metrics.map(metric => <tr key={metric.label}><th scope="row">{metric.label}</th>{metric.values.map((value, index) => <td key={steps[index].id}>{value}</td>)}<td>{metric.total}</td></tr>)}</tbody></table></div>
    {active && <div className={`cfop-hover cfop-card-${active.phase.toLowerCase()}`} role="status" style={{ top: cardPosition.top, left: `clamp(0px, calc(${cardPosition.center}px - 7.5rem), max(0px, calc(100% - 15rem)))` }}>
      <p className="cfop-tooltip-title">{active.label}</p>
      {(active.phase === 'OLL' || active.phase === 'PLL') && <div className="cfop-icon-well"><LLCaseIcon state={analysis.states[active.startIndex]} crossColor={analysis.crossColor} phase={active.phase} label={`${active.label} starting case`} /></div>}
      {active.executionNote && <p className="cfop-execution-note">{active.executionNote}</p>}
      <div className="cfop-tooltip-timing">{([['recognition', active.recognitionMs], ['execution', active.executionMs]] as const).map(([kind, ms]) => <p key={kind}><span>{kind}: </span><strong>{seconds(ms)} <small>s</small></strong><span className="cfop-timing-percent">{percent(ms, total)}</span></p>)}</div>
    </div>}
    <div className="cfop-cross-moves" role="group" aria-label={`Cross: ${crossMoves}`}><span className="cfop-cross-caption">Cross moves</span><dl><div><dt>Optimal</dt><dd>{optimum}</dd></div><div><dt>Executed</dt><dd>{steps[0].turns}</dd></div></dl></div>
  </section>;
}










