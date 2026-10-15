import { ActionBar, Disclosure, FieldRow, Metric, MetricGroup } from '../../components/ModalPatterns';
import { IconButton } from '../../components/IconButton';
import './cross-design.css';
import { NativeSelect } from '../../components/ui/native-select';
import { ArrowRight, Check, Plus, RotateCcw } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useId, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { CROSS_COLORS, type CrossColor } from '../../domain/cross';
import type { CrossMode } from '../../domain/cross-guidance';
import type { CrossRecord } from '../../domain/cross-attempt';
import type { CrossGenerator, CrossPracticeController } from '../../domain/cross-practice';
import { CrossRepository } from '../../adapters/cross-repository';
import type { LocalRepository } from '../../adapters/local-repository';
import type { SetupSolver } from '../../domain/setup';
import { Button } from '../../components/ui/button';
import { Overlay } from '../../components/Overlay';
import { HistoryTable } from '../history/HistoryTable';
import { SessionPicker } from '../settings/SessionPicker';
import { resultTPS } from '../history/result-tps';
import { requestCrossCase, requestImportedCrossCase } from '../../workers/cross-client';
import { useExerciseQueue } from '../../app/use-exercise-queue';
import { SharedCrossScramble } from './SharedCrossScramble';
import { bottomCrossHolding, bottomCrossMove } from '../../domain/cross-orientation';

const faceColors: Record<CrossColor, { backgroundColor: string; color: string }> = {
  white: { backgroundColor: '#ffffff', color: '#20242b' },
  yellow: { backgroundColor: '#ffd500', color: '#20242b' },
  red: { backgroundColor: '#c62828', color: '#ffffff' },
  orange: { backgroundColor: '#ff8c00', color: '#20242b' },
  blue: { backgroundColor: '#1565c0', color: '#ffffff' },
  green: { backgroundColor: '#16833b', color: '#ffffff' },
};
function crossTime(record: CrossRecord): string { return record.mode === 'free' || record.mode === 'mixed' ? `${(record.rawDurationMs / 1000).toFixed(2)} seconds` : '—'; }
function ModeChanges({ record }: { record: CrossRecord }) {
  return record.mode === 'mixed' ? <><p>Mixed-mode attempt · excluded from Free timing statistics</p><ol aria-label="Mode changes">{record.modeChanges?.map((change, index) => <li key={index}>{change.mode} · {(change.elapsedMs / 1000).toFixed(2)} seconds · after {change.atMoveIndex} physical turns</li>)}</ol></> : null;
}

function CrossAttemptDetails({ record, sessionName }: { record: CrossRecord; sessionName: string }) {
  const elapsed = record.startedAt === null ? 'No solve turn started' : record.mode === 'free' || record.mode === 'mixed' ? crossTime(record) : 'Not timed in guided practice';
  return <article className="cross-attempt-details" aria-label="Cross attempt">
    <header className="cross-result-header"><h3>{record.status[0].toUpperCase() + record.status.slice(1)}</h3><p>{record.case.color} cross · {record.mode === 'mixed' ? 'Mixed' : record.mode} · {record.assisted ? record.revealed ? 'Assisted (solution revealed)' : 'Assisted (guided algorithm)' : 'Unassisted'}</p><p>Session: {sessionName}</p>{record.reason && <p>{record.reason}</p>}</header>
    <MetricGroup><Metric label="Executed moves" value={record.normalizedExecutedCount} /><Metric label="Optimal moves" value={record.case.optimum} /><Metric label="Move difference" value={record.normalizedExecutedCount - record.case.optimum} /><Metric label="Time" value={elapsed} /></MetricGroup>
    <section aria-label="Cross analysis"><h3>Move analysis</h3><p>Move difference is executed moves minus optimum; unfinished attempts can be below optimum.</p><p>Performed moves: <code>{record.rawTrace.map(event => event.move).join(' ') || 'No turns recorded'}</code></p><p>Mistake episodes: {record.mistakeEpisodes}</p>{record.mode === 'mixed' && <p>Mixed-mode attempt · excluded from Free timing statistics</p>}</section>
    <SharedCrossScramble caseData={record.case} />
    <Disclosure title="Case and raw turns"><p>Full starting state: <code>{record.case.startingState}</code></p><p>Case ID: <code>{record.case.caseId}</code></p><p>{record.startedAt !== null ? new Date(record.startedAt).toISOString() : 'No solve turn started'}</p><p>Raw trace: <code>{record.rawTrace.map(event => event.move).join(' ') || '(none)'}</code></p><ModeChanges record={record} /><p>Timing basis: host monotonic receipt</p></Disclosure>
  </article>;
}

export function CrossHistory({ records, error, compact = false, repository, sessionNames = {} }: { records: CrossRecord[]; error: string | null; compact?: boolean; repository?: LocalRepository; sessionNames?: Record<string, string> }) {
  const [selected, setSelected] = useState<string | null>(null);
  if (compact) return <section aria-label="Cross practice history" className="history-panel">
    {repository && <SessionPicker repository={repository} />}
    {error && <p role="alert">{error}</p>}
    {records.length ? <HistoryTable moves entries={records.slice().reverse().map(record => ({ id: record.id, tps: record.mode === 'free' ? resultTPS(record.status, record.rawDurationMs, record.rawTrace) : '—', time: record.mode === 'mixed' ? 'Mixed' : record.mode !== 'free' ? '—' : record.status === 'completed' ? (record.rawDurationMs / 1000).toFixed(2) : record.status, moves: `${record.normalizedExecutedCount}/${record.case.optimum}` }))} selected={selected} onSelect={setSelected} previousLabel="Previous cross result" nextLabel="Next cross result" /> : <p className="empty-history">No saved cross attempts.</p>}
    <Overlay open={!!selected && records.some(record => record.id === selected)} onOpenChange={open => { if (!open) setSelected(null); }} title="Cross details" size="wide">{records.filter(record => record.id === selected).map(record => <CrossAttemptDetails key={record.id} record={record} sessionName={sessionNames[record.sessionId] ?? 'Unavailable session'} />)}</Overlay>
  </section>;
  return <section aria-label="Cross practice history"><h2>Cross practice history</h2>
    {compact && <a href="#/settings">Manage sessions</a>}
    <p>Cross attempts are separate from timed solve results and statistics.</p>
    {error && <p role="alert">{error}</p>}
    {records.length ? <ol>{records.map(record => <li key={record.id}>
      <p>{record.status} · {record.mode === 'mixed' ? 'Mixed' : record.mode} · {record.case.color} · {record.normalizedExecutedCount} moves / optimum {record.case.optimum} · {crossTime(record)} · {record.assisted ? record.revealed ? 'assisted (solution revealed)' : 'assisted (guided algorithm)' : 'unassisted'}</p>
      <p>Session: {sessionNames[record.sessionId] ?? 'Unavailable session'}{record.startedAt !== null ? ` · ${new Date(record.startedAt).toISOString()}` : ' · No solve turn started'}</p>
      {record.reason && <p>{record.reason}</p>}
      {!compact && <Disclosure title="Case and raw turns"><SharedCrossScramble caseData={record.case} /><ModeChanges record={record} /><p>Full starting state: <code>{record.case.startingState}</code></p><p>Raw trace: <code>{record.rawTrace.map(event => event.move).join(' ') || '(none)'}</code></p><p>Mistake episodes: {record.mistakeEpisodes}</p></Disclosure>}
    </li>)}</ol> : <p>No saved cross attempts.</p>}
  </section>;
}

function Feedback({ target, children }: { target?: HTMLElement | null; children: ReactNode }) { return target ? createPortal(<div className="cross-feedback">{children}</div>, target) : <div className="cross-feedback">{children}</div>; }
export function FreeCrossPractice({ session, repository, sessionReady, generate, solve, compact = false, historyTarget, feedbackTarget, enabled = true, mirrored = true }: { session: CrossPracticeController; repository: LocalRepository; sessionReady: boolean; generate?: CrossGenerator; solve?: SetupSolver; compact?: boolean; historyTarget?: HTMLElement | null; feedbackTarget?: HTMLElement | null; enabled?: boolean; mirrored?: boolean }) {
  const store = useMemo(() => new CrossRepository(repository), [repository]);
  const [color, setColor] = useState<CrossColor>('white');
  const [difficulty, setDifficulty] = useState(6);
  const [mode, setMode] = useState<CrossMode>('semi-guided');
  const [actionPending, setActionPending] = useState(false);
  const [restartRequested, setRestartRequested] = useState(false);
  const importFormId = useId();
  const importOperation = useRef<AbortController | null>(null);
  const [importCommitting, setImportCommitting] = useState(false);
  const importCommitStarted = useRef(false);
  const importVisible = useRef(false);
  useEffect(() => () => { if (!importCommitStarted.current) importOperation.current?.abort(); }, []);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importColor, setImportColor] = useState<CrossColor>('white');
  const [importError, setImportError] = useState<string | null>(null);
  const [records, setRecords] = useState<CrossRecord[]>([]);
  const [sessionNames, setSessionNames] = useState<Record<string, string>>({});
  useEffect(() => { let active = true; const load = () => { void repository.load().then(data => { if (active) setSessionNames(Object.fromEntries(data.sessions.map(session => [session.id, session.name]))); }, () => {}); }; load(); const unsubscribe = repository.subscribe(load); return () => { active = false; unsubscribe(); }; }, [repository]);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyReady, setHistoryReady] = useState(false);
  const generateNext = useMemo(() => (signal: AbortSignal) => generate ? generate(color, difficulty, signal) : requestCrossCase(color, difficulty, signal), [generate, color, difficulty]);
  const nextCase = useExerciseQueue(generateNext, enabled && sessionReady && historyReady);
  const [recoveryRevision, retryRecovery] = useReducer((value: number) => value + 1, 0);
  const [, redraw] = useReducer((value: number) => value + 1, 0);
  const cross = session.cross;
  const previous = session.previousCross;
  const showPrevious = !cross || cross.phase === 'setup' || cross.phase === 'ready';
  const shownResult = cross?.result ?? (showPrevious ? previous : null);
  const activeAttempt = cross?.phase === 'active';
  const elapsedMs = activeAttempt ? cross.elapsedMs : shownResult?.rawDurationMs ?? cross?.elapsedMs ?? 0;
  const moveCount = activeAttempt ? cross.normalizedExecutedCount : shownResult?.normalizedExecutedCount ?? cross?.normalizedExecutedCount ?? 0;
  const optimum = activeAttempt ? cross.case.optimum : shownResult?.case.optimum ?? cross?.case.optimum ?? difficulty;
  const timedMode = activeAttempt ? cross.mode === 'free' : (shownResult?.mode ?? cross?.mode ?? mode) === 'free';
  const saved = cross?.saveState === 'saved' ? `${cross.result?.id}:${cross.revealed}` : null;
  useEffect(() => {
    if (!restartRequested) return;
    if (!cross) setRestartRequested(false);
    else if (cross.phase === 'finished' && cross.saveState === 'saved') session.cancelCrossPractice();
  }, [restartRequested, cross?.phase, cross?.saveState, session]);
  function changeSettings(change: () => void) {
    if (cross) { setRestartRequested(true); session.cancelCrossPractice(); }
    change();
  }
  useEffect(() => {
    let active = true;
    void store.recoverInterruptedAttempts().then(count => { if (count && active) session.requireResynchronization(); return store.list(); }).then(value => {
      if (active) { setRecords(value); setHistoryReady(true); setHistoryError(null); }
    }, cause => { if (active) { setHistoryReady(false); setHistoryError(`Cross history could not be restored: ${String(cause)}`); } });
    return () => { active = false; };
  }, [store, session, recoveryRevision]);
  useEffect(() => {
    if (!saved) return;
    const record = cross?.result;
    if (record) setRecords(previous => [...previous.filter(value => value.id !== record.id), record].sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0) || a.id.localeCompare(b.id)));
    let active = true;
    void store.list().then(value => { if (active) { setRecords(value); setHistoryError(null); } }, cause => { if (active) setHistoryError(`Cross history could not be loaded: ${String(cause)}`); });
    return () => { active = false; };
  }, [store, saved]);
  useEffect(() => {
    if (cross?.phase !== 'active') return;
    const interval = setInterval(() => session.checkpointCross(), 1000);
    const display = setInterval(redraw, 30);
    return () => { clearInterval(interval); clearInterval(display); };
  }, [session, cross?.phase]);
  async function start(stillCurrent: () => boolean) {
    try {
      setError(null);
      const data = await repository.load();
      if (!stillCurrent()) return;
      if (!data.currentSessionId || !data.sessions.some(value => value.id === data.currentSessionId)) throw new Error('Select a saved session before starting cross practice');
      await session.startCrossPreparation(data.currentSessionId, color, difficulty, store, (_color, _difficulty, signal) => nextCase(signal), solve, { mode });
    } catch (cause) { setError(String(cause)); }
  }
  async function repeatCase() {
    if (!cross || cross.phase !== 'finished' || cross.saveState !== 'saved' || !session.canPractice) return;
    const caseData = structuredClone(cross.case);
    const repeatMode = mode;
    setActionPending(true); setError(null);
    try {
      const data = await repository.load();
      if (!data.currentSessionId || !data.sessions.some(value => value.id === data.currentSessionId)) throw new Error('Select a saved session before repeating a case');
      session.cancelCrossPractice();
      await session.startCrossPreparation(data.currentSessionId, caseData.color, caseData.optimum, store, async () => caseData, solve, { mode: repeatMode, repeat: true });
    } catch (cause) { setError(String(cause)); }
    finally { setActionPending(false); }
  }
  async function switchMode(next: CrossMode) {
    setActionPending(true); setError(null);
    try {
      if (cross && cross.phase !== 'finished') await session.switchCrossMode(next);
      setMode(next);
    } catch (cause) { setError(String(cause)); }
    finally { setActionPending(false); }
  }
  function dismissImport(open: boolean) {
    if (!open && !importCommitStarted.current) importOperation.current?.abort();
    importVisible.current = open; setImportOpen(open);
  }
  async function importCase() {
    if (importOperation.current || actionPending || !importText.trim() || !session.canPractice || !sessionReady || !historyReady) return;
    const operation = new AbortController();
    importOperation.current = operation;
    setActionPending(true); setImportError(null);
    try {
      const caseData = await requestImportedCrossCase(importText, importColor, operation.signal);
      const data = await repository.load();
      if (!data.currentSessionId || !data.sessions.some(value => value.id === data.currentSessionId)) throw new Error('Select a saved session before importing a scramble');
      if (operation.signal.aborted) return;
      importCommitStarted.current = true; setImportCommitting(true);
      await session.replaceCrossPreparation();
      setColor(caseData.color); setDifficulty(caseData.optimum); setError(null);
      await session.startCrossPreparation(data.currentSessionId, caseData.color, caseData.optimum, store, async () => caseData, solve, { mode, imported: true });
      importVisible.current = false; setImportOpen(false); setImportText('');
    } catch (cause) { if (!operation.signal.aborted) { setImportError(`${String(cause)} Check the scramble and try again.`); if (!importVisible.current) setError(`Scramble import failed: ${String(cause)} Open Import shared scramble to retry with your saved input.`); } }
    finally { importOperation.current = null; importCommitStarted.current = false; setImportCommitting(false); setActionPending(false); }
  }
  const autoReady = enabled && sessionReady && historyReady && session.canPractice && session.activity === 'idle' && !session.preparation && !cross && !actionPending && !restartRequested && !importOpen;
  useEffect(() => {
    if (!autoReady || error) return;
    let active = true;
    const timer = setTimeout(() => void start(() => active), 0);
    return () => { active = false; clearTimeout(timer); };
  }, [autoReady, error, color, difficulty, mode]);
  const locked = cross?.phase === 'active' || actionPending || restartRequested || cross?.saveState === 'pending' || cross?.saveState === 'failed';
  return <>
    <section aria-label="Cross practice" className="cross-practice-controls">
      <label>Mode <NativeSelect value={cross && cross.phase !== 'finished' ? cross.mode : mode} disabled={actionPending || restartRequested || (!!session.preparation && !cross) || cross?.revealing || cross?.saveState === 'pending' || cross?.saveState === 'failed'} onChange={event => void switchMode(event.target.value as CrossMode)}><option value="free">Free</option><option value="semi-guided">Semi-guided</option><option value="fully-guided">Fully-guided</option></NativeSelect></label>
      <label>Cross Face <NativeSelect style={faceColors[color]} value={color} disabled={locked} onChange={event => changeSettings(() => setColor(event.target.value as CrossColor))}>{CROSS_COLORS.map(value => <option style={faceColors[value]} key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</NativeSelect></label>{' '}
      <label>Difficulty
        <span className="difficulty-value" aria-hidden="true">{difficulty} moves</span>
        <input type="range" aria-label="Difficulty" min={1} max={8} step={1} value={difficulty} aria-valuetext={`${difficulty} optimal moves`} disabled={locked} onChange={event => changeSettings(() => setDifficulty(Number(event.target.value)))} /></label>{' '}
      <Button variant="outline" size="icon" aria-label="Import shared scramble" title="Import shared scramble" disabled={actionPending || restartRequested || cross?.revealing || cross?.saveState === 'pending' || cross?.saveState === 'failed'} onClick={() => { setImportColor(color); setImportError(null); dismissImport(true); }}><Plus aria-hidden="true" /></Button>
      {error && <p role="alert">{error} <Button variant="outline" onClick={() => setError(null)}>Retry preparation</Button></p>}
      <Feedback target={feedbackTarget}>
        <div className="cross-timing">{timedMode && <p className="timer-value" aria-label="Cross time" role={cross?.phase === 'active' ? 'timer' : undefined}>{(elapsedMs / 1000).toFixed(2)}</p>}<div aria-label="Cross moves" className={timedMode ? 'cross-move-counts' : 'cross-focused-moves'}>{timedMode ? <p>{moveCount} moves executed</p> : <p className="timer-value">{moveCount}<span className="move-count-caption">moves executed</span></p>}<p>{optimum} optimal moves</p></div>{(activeAttempt ? cross.assisted : shownResult?.assisted ?? cross?.assisted) && <p>Assisted</p>}</div>
        {cross && <>
        {!compact && <SharedCrossScramble caseData={cross.case} />}
        {cross.revealing && <p role="status">Computing the solution in a worker…</p>}
        {cross.mode === 'free' && cross.solution && <p>Optimal solution from original starting state: <code>{cross.solution.map(move => mirrored ? bottomCrossMove(move, cross.case.color) : move).join(' ')}</code> · assisted. Hold {mirrored ? bottomCrossHolding(cross.case.color) : 'white on top, green in front'}.</p>}
        {cross.mode === 'free' && cross.phase !== 'setup' && !cross.solution && <Button disabled={cross.revealing || actionPending || restartRequested || cross.saveState === 'failed' || cross.saveState === 'pending'} onClick={() => void session.revealCrossSolution()}>Reveal cross solution</Button>}
        {cross.phase !== 'setup' && cross.phase !== 'finished' && cross.saveState !== 'failed' && cross.saveState !== 'pending' && <Button disabled={cross.revealing} onClick={() => session.cancelCrossPractice()}>Abandon cross practice</Button>}
        {cross.phase === 'finished' && <ActionBar><IconButton label="Retry same case" disabled={actionPending || cross.revealing || cross.saveState !== 'saved' || !session.canPractice} onClick={() => void repeatCase()}><RotateCcw aria-hidden="true" /></IconButton><IconButton label="Next case" disabled={actionPending || cross.revealing || cross.saveState !== 'saved'} onClick={() => session.cancelCrossPractice()}><ArrowRight aria-hidden="true" /></IconButton></ActionBar>}
        {cross.result && cross.saveState !== 'failed' && (cross.result.status === 'completed' ? <span className="cross-success-badge" role="status"><Check size={16} aria-hidden="true" />Completed {cross.guidance?.completedMoves.length ?? cross.case.optimum}/{cross.case.optimum}</span> : <p>{cross.result.status === 'interrupted' ? 'Interrupted' : 'Abandoned'}{!compact && cross.result.reason ? `: ${cross.result.reason}` : ''}</p>)}
        {cross.saveState === 'pending' && <p role="status">Saving cross attempt…</p>}
        {cross.error && <p role="alert">{cross.saveState === 'failed' ? 'Cross attempt was not saved. ' : ''}{cross.error}</p>}
        {cross.saveState === 'failed' && <Button onClick={() => session.retryCrossSave()}>Retry cross save</Button>}
        </>}
      </Feedback>
    </section>
    <Overlay open={importOpen} onOpenChange={dismissImport} title="Import shared scramble" size="medium" footer={<ActionBar><Button type="button" variant="outline" onClick={() => dismissImport(false)}>{importCommitting ? 'Close' : 'Cancel'}</Button><Button form={importFormId} type="submit" disabled={actionPending || !importText.trim() || !session.canPractice || !sessionReady || !historyReady}>Use scramble</Button></ActionBar>}>
      <form id={importFormId} className="scramble-import" aria-busy={actionPending} onSubmit={event => { event.preventDefault(); void importCase(); }}>
        <p>Paste a scramble written for a solved cube with white on top and green in front. Setup will adapt it to your cube’s current position.</p>
        <FieldRow><span>Shared scramble</span><textarea autoFocus rows={4} value={importText} disabled={actionPending} aria-invalid={!!importError} aria-describedby={`${importFormId}-feedback`} onChange={event => setImportText(event.target.value)} placeholder="R U2 F'…" /></FieldRow>
        <FieldRow><span>Cross color</span><NativeSelect value={importColor} disabled={actionPending} onChange={event => setImportColor(event.target.value as CrossColor)}>{CROSS_COLORS.map(value => <option key={value} value={value}>{value}</option>)}</NativeSelect></FieldRow>
        <p>Difficulty is calculated from the scramble. Importing replaces the current attempt and saves an unfinished solve as abandoned.</p>
        <p id={`${importFormId}-feedback`} role={importError ? 'alert' : 'status'}>{importError ?? (importCommitting ? 'Finishing imported setup… Closing keeps preparation running.' : actionPending ? 'Preparing imported scramble… Cancel or close to stop computation.' : !session.canPractice ? 'Connect and synchronize your cube before importing.' : !sessionReady || !historyReady ? 'Wait for local sessions and history to finish loading.' : 'Enter a scramble, choose its cross color, then use it to begin setup.')}</p>
      </form>
    </Overlay>
    {historyTarget ? createPortal(<CrossHistory records={records} error={historyError} compact={compact} repository={repository} sessionNames={sessionNames} />, historyTarget) : <CrossHistory records={records} error={historyError} compact={compact} repository={repository} sessionNames={sessionNames} />}
    {historyError && <Button disabled={!!session.preparation && !historyReady} onClick={() => {
      if (!historyReady) retryRecovery();
      else void store.list().then(value => { setRecords(value); setHistoryError(null); }, cause => setHistoryError(`Cross history could not be loaded: ${String(cause)}`));
    }}>Retry cross history restoration</Button>}
  </>;
}

