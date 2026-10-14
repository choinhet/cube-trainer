import { DEFAULT_VIEW_ANGLE, MIN_VIEW_ANGLE, MAX_VIEW_ANGLE, isValidViewAngle } from '../../domain/view-preferences';
import { Button } from '../../components/ui/button';
import { useEffect, useState } from 'react';
import { LocalRepository, type LocalData, type Settings } from '../../adapters/local-repository';

export function LocalSessions({ repository, onReady, onSettings }: { repository: LocalRepository; onReady: (ready: boolean) => void; onSettings?: (settings: Settings) => void }) {
  const [data, setData] = useState<LocalData | null>(null);
  const [angleDraft, setAngleDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void (onSettings ? repository.initialize() : repository.load()).then(restored => {
      if (active) { setData(restored); onSettings?.(restored.settings); setBusy(false); }
    }, value => { if (active) { setError(`Local data could not be restored: ${String(value)}`); setBusy(false); } });
    return () => { active = false; };
  }, [repository]);
  const current = data?.sessions.find(session => session.id === data.currentSessionId);
  useEffect(() => { onReady(!!current); }, [current, onReady]);

  async function save(action: () => Promise<LocalData>, after?: () => void): Promise<void> {
    setBusy(true); setError(null);
    try { const committed = await action(); setData(committed); after?.(); }
    catch (value) { setData(data); setAngleDraft(null); setError(`Changes were not saved. ${String(value)} Retry after checking browser storage.`); }
    finally { setBusy(false); }
  }
  return <section aria-labelledby="local-sessions"><h2 id="local-sessions">Preferences</h2>
    {error && <p role="alert">{error}</p>}
    {!data ? <><p>{busy ? 'Restoring local data…' : 'Local data unavailable; practice is blocked.'}</p><Button disabled={busy} onClick={() => void save(async () => { const restored = await (onSettings ? repository.initialize() : repository.load()); onSettings?.(restored.settings); return restored; })}>Retry local storage</Button></> : <>
      {onSettings && <div className="settings-options">{(['inspection', 'showFaceLabels', 'mirroredCrossInstructions', 'locked3dMode', 'debug'] as const).map(key => <label key={key}><input type="checkbox" checked={key === 'mirroredCrossInstructions' ? data.settings[key] !== false : !!data.settings[key]} disabled={busy} onChange={event => {
        const settings = { ...data.settings, [key]: event.target.checked };
        setData({ ...data, settings });
        void save(async () => { await repository.saveSettings(settings); onSettings(settings); return { ...data, settings }; });
      }} />{key === 'locked3dMode' ? 'Locked 3D mode' : key === 'debug' ? 'Enable Debug' : key === 'mirroredCrossInstructions' ? 'Mirrored instructions for the cross trainer' : key === 'showFaceLabels' ? 'Show cube face labels (U, F, R, D, L, B)' : 'Use inspection (15 seconds, +2 until 17 seconds, then DNF)'}</label>)}
        <label>Default angle (degrees)<input type="number" min={MIN_VIEW_ANGLE} max={MAX_VIEW_ANGLE} step="any" disabled={busy} value={angleDraft ?? String(data.settings.defaultAngle ?? DEFAULT_VIEW_ANGLE)} onChange={event => {
          const value = event.target.value;
          setAngleDraft(value);
          const defaultAngle = Number(value);
          if (!value.trim() || !isValidViewAngle(defaultAngle)) return;
          const settings = { ...data.settings, defaultAngle };
          void save(async () => { await repository.saveSettings(settings); onSettings(settings); return { ...data, settings }; }, () => setAngleDraft(null));
        }} /></label>
      </div>}
    </>}
  </section>;
}
