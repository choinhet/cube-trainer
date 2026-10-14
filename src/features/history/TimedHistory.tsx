import { useEffect, useReducer, useState } from 'react';
import type { LocalData, LocalRepository } from '../../adapters/local-repository';
import { formatSolveTime, type Penalty, type TimedResult } from '../../domain/timed-attempt';
import { eligibleTimedResult } from '../../domain/timed-history';
import { Button } from '../../components/ui/button';
import { IconButton } from '../../components/IconButton';
import { Trash2 } from 'lucide-react';
import { Table, TableBody, TableHead, TableRow, TableCell } from '../../components/ui/table';
import { HistoryTable } from './HistoryTable';
import { Overlay } from '../../components/Overlay';
import { SessionPicker } from '../settings/SessionPicker';
import { resultTPS } from './result-tps';

function HistoryRow({ result, sessionName, current, repository, timezone }: { result: TimedResult; sessionName: string; current: boolean; repository: LocalRepository; timezone?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timestamp = new Date(result.startedAt).toISOString();
  const formattedDate = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: timezone, timeZoneName: 'short' }).format(result.startedAt);
  const hasRawTime = result.solveStarted === true || (result.solveStarted !== false && result.rawDurationMs > 0);
  async function write(kind: 'penalty' | 'delete', penalty?: Penalty): Promise<void> {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      if (kind === 'penalty') await repository.editTimedPenalty(result.id, penalty!);
      else await repository.deleteTimedResult(result.id);
    } catch (value) {
      setError(`${kind === 'penalty' ? 'Penalty was not saved.' : 'Result was not deleted.'} ${String(value)} The saved record is still shown. Retry after checking browser storage.`);
    } finally { setBusy(false); }
  }
  return <li className="solve-detail" aria-label={`Attempt started ${formattedDate}`}>
    <Table className="solve-metadata" aria-label="Solve details">
      <TableBody>
        <TableRow><TableHead scope="row">Session</TableHead><TableCell>{sessionName} ({current ? 'current session' : 'historical session'})</TableCell></TableRow>
        <TableRow><TableHead scope="row">Date</TableHead><TableCell><time dateTime={timestamp}>{formattedDate}</time></TableCell></TableRow>
        <TableRow><TableHead scope="row">Status</TableHead><TableCell>{result.status === 'interrupted' ? 'Interrupted' : 'Completed'}</TableCell></TableRow>
        <TableRow><TableHead scope="row">Time</TableHead><TableCell>{result.status === 'interrupted' ? 'Unavailable' : formatSolveTime(result)}</TableCell></TableRow>
        <TableRow><TableHead scope="row">Raw time</TableHead><TableCell>{hasRawTime ? `${(result.rawDurationMs / 1000).toFixed(2)} s` : 'Solve timing had not started.'}</TableCell></TableRow>
        <TableRow><TableHead scope="row">TPS</TableHead><TableCell>{resultTPS(result.status, result.rawDurationMs, result.rawTurns)}</TableCell></TableRow>
        <TableRow><TableHead scope="row">Statistics</TableHead><TableCell>{eligibleTimedResult(result) ? 'Included' : 'Excluded from timed statistics.'}</TableCell></TableRow>
        {result.reason && <TableRow><TableHead scope="row">Reason</TableHead><TableCell>{result.reason}</TableCell></TableRow>}
      </TableBody>
    </Table>
    <div className="solve-detail-actions">
      {result.status === 'completed' && <div className="penalty-toggles" role="group" aria-label="Solve penalty">{(['+2', 'dnf'] as const).map(penalty => <Button key={penalty} variant={result.penalty === penalty ? 'default' : 'outline'} aria-pressed={result.penalty === penalty} disabled={busy} onClick={() => void write('penalty', result.penalty === penalty ? 'none' : penalty)}>{penalty === 'dnf' ? 'DNF' : '+2'}</Button>)}</div>}
      <IconButton label="Delete result" className="delete-result" disabled={busy} onClick={() => void write('delete')}><Trash2 /></IconButton>
    </div>
    {busy && <p role="status">Saving history change…</p>}
    {error && <p role="alert">{error}</p>}
  </li>;
}

export function TimedHistory({ repository, refreshKey, compact = false }: { repository: LocalRepository; refreshKey?: string | number; compact?: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [version, refresh] = useReducer((value: number) => value + 1, 0);
  const [records, setRecords] = useState<TimedResult[]>([]);
  const [data, setData] = useState<LocalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => repository.subscribe(refresh), [repository]);
  useEffect(() => {
    let active = true; setLoading(true);
    void Promise.all([repository.load(), repository.listTimedResults()]).then(([local, results]) => {
      if (active) { setData(local); setRecords(results); setError(null); setLoading(false); }
    }, value => { if (active) { setError(`Saved history could not be loaded: ${String(value)}`); setLoading(false); } });
    return () => { active = false; };
  }, [repository, version, refreshKey]);
  if (compact) return <section className="history-panel" aria-label="Saved timed results">
    <SessionPicker repository={repository} />
    {error && <p role="alert">{error} <Button onClick={refresh}>Retry history</Button></p>}
    {loading && !data && <p role="status">Loading history…</p>}
    {records.length > 0 ? <HistoryTable entries={records.slice().reverse().map(result => ({ id: result.id, tps: resultTPS(result.status, result.rawDurationMs, result.rawTurns), time: result.status === 'interrupted' ? 'Interrupted' : formatSolveTime(result) }))} selected={selected} onSelect={setSelected} previousLabel="Previous results" nextLabel="Next results" /> : !loading && !error && <p className="empty-history">No saved timed results.</p>}
    <Overlay open={!!selected && records.some(result => result.id === selected)} onOpenChange={open => { if (!open) setSelected(null); }} title="Solve details">{records.filter(result => result.id === selected).map(result => <ol className="result-details" key={result.id}><HistoryRow result={result} sessionName={data?.sessions.find(session => session.id === result.sessionId)?.name ?? 'Unavailable session'} current={result.sessionId === data?.currentSessionId} repository={repository} timezone={data?.settings.reportingTimezone} /></ol>)}</Overlay>
  </section>;
  return <section aria-label="Saved timed results"><h2>Saved timed results</h2>
    {records.length ? <ol>{records.map(result => <HistoryRow key={result.id} result={result} sessionName={data?.sessions.find(session => session.id === result.sessionId)?.name ?? 'Unavailable session'} current={result.sessionId === data?.currentSessionId} repository={repository} timezone={data?.settings.reportingTimezone} />)}</ol> : !records.length && !loading && !error && <p>No saved timed results.</p>}
  </section>;
}

