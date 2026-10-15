import { Disclosure, FieldRow } from '../../components/ModalPatterns';
import { DEFAULT_VIEW_ANGLE, MIN_VIEW_ANGLE, MAX_VIEW_ANGLE, isValidViewAngle } from '../../domain/view-preferences';
import { Button } from '../../components/ui/button';
import { CubeView, type Quaternion } from '../../components/CubeView';
import { SOLVED } from '../../domain/cube';
import { useEffect, useState } from 'react';
import { LocalRepository, type LocalData, type Settings } from '../../adapters/local-repository';

export function LocalSessions({ repository, onReady, onSettings, facelets, orientation = null }: { repository: LocalRepository; onReady: (ready: boolean) => void; onSettings?: (settings: Settings) => void; facelets?: string | null; orientation?: Quaternion | null }) {
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
  function checkbox(key: 'inspection' | 'showFaceLabels' | 'mirroredCrossInstructions' | 'locked3dMode' | 'debug', text: string) {
    if (!data || !onSettings) return null;
    return <FieldRow><input type="checkbox" checked={key === 'mirroredCrossInstructions' ? data.settings[key] !== false : !!data.settings[key]} disabled={busy} onChange={event => {
      const settings = { ...data.settings, [key]: event.target.checked };
      setData({ ...data, settings });
      void save(async () => { await repository.saveSettings(settings); onSettings(settings); return { ...data, settings }; });
    }} /><span>{text}</span></FieldRow>;
  }
  return <section aria-labelledby="local-sessions"><h2 id="local-sessions">Preferences</h2>
    {error && <p role="alert">{error}</p>}{data && busy && <p role="status">Saving preferences…</p>}
    {!data ? <><p>{busy ? 'Restoring local data…' : 'Local data unavailable; practice is blocked.'}</p><Button disabled={busy} onClick={() => void save(async () => { const restored = await (onSettings ? repository.initialize() : repository.load()); onSettings?.(restored.settings); return restored; })}>Retry local storage</Button></> : <>
      {onSettings && <div className="settings-options">
        <Disclosure defaultOpen title="3D viewer"><div className="viewer-settings">
          <div className="viewer-controls">
            {checkbox('locked3dMode', 'Locked 3D mode')}
            {checkbox('showFaceLabels', 'Show cube face labels (U, F, R, D, L, B)')}
            <FieldRow hint="Adjust the horizontal angle of the locked view.">Default angle (degrees)<input type="number" min={MIN_VIEW_ANGLE} max={MAX_VIEW_ANGLE} step="any" disabled={busy} value={angleDraft ?? String(data.settings.defaultAngle ?? DEFAULT_VIEW_ANGLE)} onChange={event => {
          const value = event.target.value;
          setAngleDraft(value);
          const defaultAngle = Number(value);
          if (!value.trim() || !isValidViewAngle(defaultAngle)) return;
          const settings = { ...data.settings, defaultAngle };
          void save(async () => { await repository.saveSettings(settings); onSettings(settings); return { ...data, settings }; }, () => setAngleDraft(null));
            }} /></FieldRow>
            
          </div>
          <figure className="settings-preview">
            <CubeView key={data.settings.defaultAngle ?? DEFAULT_VIEW_ANGLE} label="3D cube preview" facelets={facelets ?? SOLVED} orientation={orientation} locked3dMode={!!data.settings.locked3dMode} initialCameraAngle={data.settings.defaultAngle ?? DEFAULT_VIEW_ANGLE} defaultAngle={data.settings.defaultAngle ?? DEFAULT_VIEW_ANGLE} showFaceLabels={!!data.settings.showFaceLabels} />
            <figcaption>3D cube preview</figcaption>
          </figure>
        </div></Disclosure>
        <Disclosure defaultOpen title="Solve">{checkbox('inspection', 'Use inspection (15 seconds, +2 until 17 seconds, then DNF)')}</Disclosure>
        <Disclosure defaultOpen title="Cross Trainer">{checkbox('mirroredCrossInstructions', 'Mirrored instructions for the cross trainer')}</Disclosure>
        <Disclosure defaultOpen title="Advanced">{checkbox('debug', 'Enable Debug')}</Disclosure>
      </div>}
    </>}
  </section>;
}
