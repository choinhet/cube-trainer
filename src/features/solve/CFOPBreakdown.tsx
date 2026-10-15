import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Disclosure, Metric, MetricGroup } from '../../components/ModalPatterns';
import './solve-details.css';
import { analyzeCFOP } from '../../domain/cfop-analysis';
import type { TimedResult } from '../../domain/timed-attempt';
import { analyzeF2LPairs } from '../../domain/cfop-pairs';
import { analyzeLLAlgorithms } from '../../domain/cfop-algorithms';
import { CrossSolver, type CrossColor } from '../../domain/cross';
import { countExecutedMoves } from '../../domain/cross-guidance';
import { resultTPS } from '../history/result-tps';
import { LLCaseIcon } from './LLCaseIcon';

const solvers = new Map<CrossColor, CrossSolver>();
const seconds = (ms: number) => (ms / 1000).toFixed(2);
const percent = (part: number, total: number) => `${(total > 0 ? part / total * 100 : 0).toFixed(2)}%`;

export function CFOPBreakdown({ result, details, compact = false }: { result: TimedResult; details?: ReactNode; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const analysisId = useId();
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cardPosition, setCardPosition] = useState({ left: 0, top: 0 });
  const opener = useRef<HTMLElement | null>(null);
  const previewAnchor = useRef<HTMLElement | null>(null);
  const card = useRef<HTMLDivElement | null>(null);
  const detailsId = useId();
  function positionCard(element: HTMLElement) {
    const section = element.closest('.cfop-breakdown')!.getBoundingClientRect();
    const target = element.getBoundingClientRect();
    const width = Math.min(240, section.width);
    const viewport = element.closest('.modal-body')?.getBoundingClientRect();
    const height = card.current?.offsetHeight ?? 240;
    const fitsBelow = target.bottom + 8 + height <= Math.min(window.innerHeight, viewport?.bottom ?? window.innerHeight);
    const fitsAbove = target.top - 8 - height >= Math.max(0, viewport?.top ?? 0);
    const top = !fitsBelow && fitsAbove ? target.top - height - 8 : target.bottom + 8;
    setCardPosition({ left: Math.max(0, Math.min(section.width - width, target.left + target.width / 2 - section.left - width / 2)), top: top - section.top });
  }
  function showCard(key: string, element: HTMLElement) { previewAnchor.current = element; positionCard(element); setPreview(key); }
  function clearPreview() { previewAnchor.current = null; setPreview(null); if (selected && opener.current) positionCard(opener.current); }
  function activate(key: string, element: HTMLElement) {
    opener.current = element;
    positionCard(element);
    setSelected(selected === key ? null : key);
    setPreview(null);
  }
  function dismiss() { setSelected(null); opener.current?.focus(); setPreview(null); }
  useLayoutEffect(() => {
    const anchor = preview ? previewAnchor.current : opener.current;
    if ((preview || selected) && anchor && card.current) positionCard(anchor);
  }, [preview, selected]);
  useEffect(() => {
    if (!selected) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation();
      setSelected(null); opener.current?.focus(); setPreview(null);
    };
    // Intercept before the containing Radix dialog's document Escape listener.
    window.addEventListener('keydown', closeOnEscape, true);
    return () => window.removeEventListener('keydown', closeOnEscape, true);
  }, [selected]);
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
  if (result.status !== 'completed') return details ? <Disclosure title="Details">{details}</Disclosure> : null;
  if (!data) return <><MetricGroup><Metric label="Turns" value={result.rawTurns?.length ?? '—'} /><Metric label="TPS (turns per second)" value={resultTPS(result.status, result.rawDurationMs, result.rawTurns)} /></MetricGroup><p className="cfop-unavailable">Detailed timing unavailable</p>{details && <Disclosure title="Details">{details}</Disclosure>}</>;
  const { analysis, steps, optimum } = data;
  const crossMoves = `${optimum} optimal / ${steps[0].turns} executed cross moves`;
  const segments = steps.flatMap(step => (['recognition', 'execution'] as const).map(kind => ({ ...step, kind, key: `${step.id}-${kind}`, ms: kind === 'recognition' ? step.recognitionMs : step.executionMs })));
  const active = segments.find(segment => segment.key === (preview ?? selected));
  const recognition = steps.reduce((sum, step) => sum + step.recognitionMs, 0);
  const turns = steps.reduce((sum, step) => sum + step.turns, 0);
  const total = result.rawDurationMs;
  const metrics = [
    { label: 'Recognition', values: steps.map(step => step.phase === 'Cross' ? '—' : seconds(step.recognitionMs)), total: `${seconds(recognition)} (${percent(recognition, total)})` },
    { label: 'Execution', values: steps.map(step => seconds(step.executionMs)), total: `${seconds(total - recognition)} (${percent(total - recognition, total)})` },
    { label: 'Step time', values: steps.map(step => `${seconds(step.durationMs)} (${percent(step.durationMs, total)})`), total: seconds(total) },
    { label: 'Executed moves', values: steps.map(step => String(step.turns)), total: String(turns) },
    { label: 'Moves per second', values: steps.map(step => (step.durationMs > 0 ? step.turns * 1000 / step.durationMs : 0).toFixed(2)), total: (total > 0 ? turns * 1000 / total : 0).toFixed(2) },
  ];
  return <section className="cfop-breakdown solve-analysis" data-compact={compact} data-expanded={expanded} aria-label="CFOP phase timing" onKeyDown={event => { if (event.key === 'Escape' && selected) { event.preventDefault(); event.stopPropagation(); dismiss(); } }}>
    <p className="analysis-context">{analysis.crossColor[0].toUpperCase() + analysis.crossColor.slice(1)} cross · CFOP analysis</p>
    <MetricGroup><Metric label="Recognition" value={`${seconds(recognition)} s`} /><Metric label="Execution" value={`${seconds(total - recognition)} s`} /><Metric label="Turns" value={result.rawTurns?.length ?? '—'} /><Metric label="TPS (turns per second)" value={resultTPS(result.status, total, result.rawTurns)} /></MetricGroup>
    <div className="cfop-legend" aria-label="Timeline legend"><span><i className="recognition-key" />Recognition</span><span><i className="execution-key" />Execution (phase color)</span>{analysis.phases.map(phase => <span key={phase.phase}><i className={`phase-key cfop-${phase.phase.toLowerCase()}`} />{phase.phase}</span>)}</div>
    <div className="cfop-bar" aria-label="Phase timing bar" onMouseLeave={clearPreview}>
      {analysis.phases.filter(phase => phase.durationMs > 0).map(phase => <div role="group" aria-label={`${phase.phase} phase`} className="cfop-phase-group" key={phase.phase} style={{ flexGrow: phase.durationMs }}>{segments.filter(segment => segment.phase === phase.phase && segment.ms > 0).map(segment => <button type="button" key={segment.key} className={`cfop-segment cfop-${segment.phase.toLowerCase()} cfop-${segment.kind}`} style={{ flexGrow: segment.ms }} aria-label={`${segment.label} ${segment.kind}: ${seconds(segment.ms)} seconds`} aria-pressed={selected === segment.key} aria-controls={detailsId} onClick={event => activate(segment.key, event.currentTarget)} onMouseEnter={event => showCard(segment.key, event.currentTarget)} onFocus={event => showCard(segment.key, event.currentTarget)} onBlur={clearPreview}><span className="sr-only">{segment.shortLabel}</span></button>)}</div>)}
    </div>
    {compact && <div className="phase-summary">{analysis.phases.map(phase => <span className={`phase-summary-item cfop-${phase.phase.toLowerCase()}`} key={phase.phase}><span>{phase.phase}</span><strong>{seconds(phase.durationMs)} <small>s</small></strong></span>)}</div>}
    {compact && <Button className="analysis-toggle" variant="ghost" aria-expanded={expanded} aria-controls={analysisId} onClick={() => { setExpanded(!expanded); dismiss(); }}>{expanded ? 'Hide analysis' : 'View analysis'}</Button>}
    <div id={analysisId} hidden={compact && !expanded}>
    <p className="analysis-hint">Select a phase or step for details. Times are seconds.</p>
    <div className="cfop-table-scroll" role="region" aria-label="Step analysis table, scroll horizontally" tabIndex={0}><table className="cfop-analysis-table" aria-label="Step analysis"><thead><tr><th scope="col">Step analysis</th>{steps.map(step => <th scope="col" key={step.id} onMouseEnter={event => showCard(`${step.id}-execution`, event.currentTarget)} onMouseLeave={clearPreview} onFocus={event => showCard(`${step.id}-execution`, event.currentTarget)} onBlur={clearPreview}><button type="button" className="phase-detail-trigger" aria-label={`Show ${step.label} details`} aria-expanded={selected === `${step.id}-execution`} aria-controls={detailsId} onClick={event => activate(`${step.id}-execution`, event.currentTarget)}>{step.shortLabel}<small>{step.label !== step.shortLabel ? step.label : ''}</small>{step.executionNote && <small className="cfop-execution-note">{step.executionNote}</small>}</button></th>)}<th scope="col">Total</th></tr></thead><tbody>{metrics.map(metric => <tr key={metric.label}><th scope="row">{metric.label}</th>{metric.values.map((value, index) => <td key={steps[index].id}>{value}</td>)}<td>{metric.total}</td></tr>)}</tbody></table></div>
    </div>
    {active && <div ref={card} id={detailsId} className={`cfop-hover cfop-card-${active.phase.toLowerCase()}`} data-pinned={!!selected} role={selected ? 'region' : 'status'} aria-label={selected ? 'Phase details' : undefined} style={cardPosition}>
      <div className="cfop-tooltip-heading"><p className="cfop-tooltip-title">{active.label}</p>{selected && <Button variant="ghost" size="icon" aria-label="Close phase details" onClick={dismiss}><X aria-hidden="true" /></Button>}</div>
      {(active.phase === 'OLL' || active.phase === 'PLL') && <div className="cfop-icon-well"><LLCaseIcon state={analysis.states[active.startIndex]} crossColor={analysis.crossColor} phase={active.phase} label={`${active.label} starting case`} /></div>}
      {active.executionNote && <p className="cfop-execution-note">{active.executionNote}</p>}
      <div className="cfop-tooltip-timing">{([['recognition', active.recognitionMs], ['execution', active.executionMs]] as const).map(([kind, ms]) => <p key={kind}><span>{kind}: </span><strong>{seconds(ms)} <small>s</small></strong><span className="cfop-timing-percent">{percent(ms, total)}</span></p>)}</div>
    </div>}
    <div hidden={compact && !expanded}>
    <div className="cfop-cross-moves" role="group" aria-label={`Cross: ${crossMoves}`}><span className="cfop-cross-caption">Cross moves</span><dl><div><dt>Optimal</dt><dd>{optimum}</dd></div><div><dt>Executed</dt><dd>{steps[0].turns}</dd></div></dl></div>
    <Disclosure title="Details">{details}<p>Overall turns and TPS count physical face-turn events; step executed moves combine consecutive quarter turns into half turns.</p><table className="cumulative-times" aria-label="Cumulative phase times"><thead><tr><th scope="col">Step</th><th scope="col">Elapsed seconds</th></tr></thead><tbody>{steps.map(step => <tr key={step.id}><th scope="row">{step.label}</th><td>{seconds(step.endMs)}</td></tr>)}</tbody></table></Disclosure>
    </div>
  </section>;
}
