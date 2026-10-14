import { Button } from '../../components/ui/button';
import { Overlay } from '../../components/Overlay';
import { NativeSelect } from '../../components/ui/native-select';
import { useEffect, useReducer, useState } from 'react';
import type { LocalData, LocalRepository } from '../../adapters/local-repository';
const NEW_SESSION = '__new_session__';

export function SessionPicker({ repository }: { repository: LocalRepository }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<LocalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, refresh] = useReducer((n: number) => n + 1, 0);
  useEffect(() => repository.subscribe(refresh), [repository]);
  useEffect(() => { let active = true; void repository.load().then(value => { if (active) setData(value); }, cause => { if (active) setError(`Sessions unavailable: ${String(cause)}`); }); return () => { active = false; }; }, [repository, version]);
  async function create(): Promise<void> {
    setBusy(true); setError(null);
    try { await repository.createSession(name); setName(''); setCreating(false); }
    catch (cause) { setError(`Session was not created: ${String(cause)}`); }
    finally { setBusy(false); }
  }
  return <>
    <label className="session-picker">Session
      <NativeSelect aria-label="History session" value={data?.currentSessionId ?? ''} onChange={event => {
        if (event.target.value === NEW_SESSION) {
          event.target.value = data?.currentSessionId ?? '';
          setError(null);
          setCreating(true);
          return;
        }
        void repository.selectSession(event.target.value).then(() => setError(null), cause => setError(`Session was not changed: ${String(cause)}`));
      }}>
        {data?.sessions.map(session => <option key={session.id} value={session.id}>{session.name}</option>)}
        <option value={NEW_SESSION}>New session</option>
      </NativeSelect>
    </label>
    <Overlay open={creating} onOpenChange={setCreating} title="New session">
      <form onSubmit={event => { event.preventDefault(); void create(); }}>
        <label>New session name<input autoFocus value={name} disabled={busy} onChange={event => setName(event.target.value)} maxLength={120} /></label>
        {error && <p role="alert">{error}</p>}
        <Button disabled={busy || !name.trim()}>Create session</Button>
      </form>
    </Overlay>
    {error && !creating && <p role="alert">{error}</p>}
  </>;
}
