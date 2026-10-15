import { DiagnosticText } from '../features/diagnostics/DiagnosticText';
import { DEFAULT_VIEW_ANGLE } from '../domain/view-preferences';
import { useEffect, useReducer, useState } from 'react';
import { App } from '../features/diagnostics/App';
import { CrossCases } from '../features/diagnostics/CrossCases';
import { GuidanceSteps } from '../components/GuidanceSteps';
import { FreeCrossPractice } from '../features/cross/FreeCrossPractice';
import { CrossTrainingGuidance } from '../features/cross/CrossTrainingGuidance';
import { SharedCrossScramble } from '../features/cross/SharedCrossScramble';
import type { CrossGenerator } from '../domain/cross-practice';
import { Button } from '../components/ui/button';
import { Overlay } from '../components/Overlay';
import { DeviceControls } from '../features/settings/DeviceControls';
import { SolveTiming } from '../features/solve/SolveTiming';
import { Box, Bluetooth, Settings as SettingsIcon, ChartNoAxesColumnIncreasing, Crosshair } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { TimedHistory } from '../features/history/TimedHistory';
import { LiveSession } from './live-session';
import type { Connection } from '../domain/session';
import { CubeView } from '../components/CubeView';

import { LocalRepository, type Settings } from '../adapters/local-repository';
import { LocalSessions } from '../features/settings/LocalSessions';
import type { PracticeScramble } from '../domain/scramble';
import type { SetupSolver } from '../domain/setup';
import { requestPracticeScramble } from '../workers/scramble-client';
import { useExerciseQueue } from './use-exercise-queue';
interface Props { connectCube: () => Promise<Connection>; bluetoothAvailable?: boolean; repository?: LocalRepository; generateScramble?: (signal: AbortSignal) => Promise<PracticeScramble>; generateCross?: CrossGenerator; solveSetup?: SetupSolver; monotonicClock?: () => number; wallClock?: () => number }
export function LiveApp({ connectCube, bluetoothAvailable = window.isSecureContext && !!navigator.bluetooth, repository: providedRepository, generateScramble, generateCross, solveSetup, monotonicClock = () => performance.now(), wallClock = Date.now }: Props) {
  const [, redraw] = useReducer((value: number) => value + 1, 0);
  const [session] = useState(() => new LiveSession(connectCube, monotonicClock, redraw, wallClock));
  const [error, setError] = useState<string | null>(null);
  const [repository] = useState(() => providedRepository ?? new LocalRepository());
  const [sessionReady, setSessionReady] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [route, setRoute] = useState(window.location.hash.slice(2) || 'solve');

  const [debugStep, setDebugStep] = useState(1);
  const [deviceOpen, setDeviceOpen] = useState(false);
  const [crossFeedbackTarget, setCrossFeedbackTarget] = useState<HTMLElement | null>(null);
  const [crossHistoryTarget, setCrossHistoryTarget] = useState<HTMLElement | null>(null);
  const page = ['solve', 'cross', 'insights', 'settings'].includes(route) || (route === 'debug' && settings?.debug) ? route : 'solve';
  const contentPage = page === 'settings' ? 'solve' : page;
  const nextScramble = useExerciseQueue(generateScramble ?? requestPracticeScramble, contentPage === 'solve' && page !== 'settings' && sessionReady);
  useEffect(() => { if (session.solvedResetPending) setDeviceOpen(true); }, [session.solvedResetPending, session.solvedResetVersion]);
  function navigate(next: string): void {
    if (next !== page) {
      if (session.isCrossPractice) session.cancelCrossPractice();
      else if (session.timed || session.preparation) session.cancelPreparation();
    }
    setRoute(next); if (window.location.hash !== `#/${next}`) window.history.pushState(null, '', `#/${next}`);
  }
  useEffect(() => {
    const changed = () => navigate(window.location.hash.slice(2) || 'solve');
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  });
  useEffect(() => {
    if (!settings) return;
    if (route !== page) { setRoute(page); window.history.replaceState(null, '', `#/${page}`); }
  }, [settings, route, page]);
  useEffect(() => {
    let active = true;
    void repository.initialize().then(data => { if (active) { setSettings(data.settings); setSessionReady(true); } }, cause => { if (active) setError(`Local data could not be restored: ${String(cause)}`); });
    return () => { active = false; };
  }, [repository]);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveryVersion, retryRecovery] = useReducer((value: number) => value + 1, 0);
  const timed = session.timed;
  const savedAttempt = timed?.saveState === 'saved' ? timed.result?.id : null;
  useEffect(() => {
    let active = true;
    setRecoveryReady(false);
    void repository.recoverInterruptedAttempts().then(recovered => { if (active) { if (recovered.length) session.requireResynchronization(); setRecoveryReady(true); setRecoveryError(null); } }, value => { if (active) setRecoveryError(`Interrupted attempt recovery was not saved: ${String(value)}`); });
    return () => { active = false; };
  }, [repository, recoveryVersion]);
  useEffect(() => {
    if (timed?.phase !== 'inspection' && timed?.phase !== 'active') return;
    const timer = window.setInterval(redraw, 30);
    const checkpoint = window.setInterval(() => session.checkpointActiveAttempt(), 1000);
    return () => { window.clearInterval(timer); window.clearInterval(checkpoint); };
  }, [timed?.phase]);
  async function startTimed(stillCurrent: () => boolean): Promise<void> {
    try {
      setError(null);
      const data = await repository.load();
      if (!stillCurrent()) return;
      if (!data.currentSessionId || !data.sessions.some(value => value.id === data.currentSessionId)) throw new Error('Select a saved session before starting practice');
      if (!recoveryReady) throw new Error('Finish interrupted-attempt recovery before starting practice');
      await session.startTimedPreparation(data.currentSessionId, !!settings?.inspection, result => repository.finalizeTimedAttempt(result), nextScramble, solveSetup,
        { checkpoint: value => repository.saveCheckpoint(value), clear: id => repository.clearCheckpoint(id) });
    } catch (value) { setError(String(value)); }
  }
  const autoReady = contentPage === 'solve' && page !== 'settings' && !deviceOpen && sessionReady && recoveryReady && session.canPractice && session.activity === 'idle' && !session.preparation && !session.timed && !session.isCrossPractice;
  useEffect(() => {
    if (contentPage === 'solve' && page !== 'settings' && !deviceOpen && timed?.phase === 'completed' && timed.saveState === 'saved') session.cancelPreparation();
  }, [contentPage, page, deviceOpen, savedAttempt, session]);
  useEffect(() => {
    if (!autoReady || error) return;
    let active = true;
    // Deferring allows route/dialog changes to cancel before reserving an attempt.
    const timer = window.setTimeout(() => { if (active) void startTimed(() => active); }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [autoReady, error]);
  const snapshot = session.diagnostic.snapshot();

  const preparation = session.preparation;
  function confirm(action: () => void): void {
    try { action(); setError(null); }
    catch (value) { setError(String(value)); }
  }
  function openDevice(): void {
    setDeviceOpen(true);
    if (session.cross?.phase === 'setup' || (session.timed && ['setup', 'ready', 'inspection'].includes(session.timed.phase))) session.cancelPreparation();
  }
  function downloadTrace(): void {
    const report = { schemaVersion: 1, adapter: 'gan-web-bluetooth@3.0.2', capturedAt: new Date().toISOString(), browserUserAgent: navigator.userAgent, deviceName: session.deviceName, timingBasis: session.timingBasis, physicalViewerAcceptance: 'pending tester verification', snapshot, currentTrace: session.diagnostic.trace(), previousRuns: session.previousRuns };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `cube-viewer-${Date.now()}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <main className="app-shell">
    <header className="app-header">
      <a className="brand" href="#/solve" aria-label="Cube Trainer" onClick={event => { event.preventDefault(); navigate('solve'); }}><span className="brand-mark"><Box size={20} aria-hidden="true" /></span>Cube Trainer</a>
      <nav aria-label="Pages">{[['solve', 'Solve', Box], ['cross', 'Cross Trainer', Crosshair], ['insights', 'Insights', ChartNoAxesColumnIncreasing], ...(settings?.debug ? [['debug', 'Debug', Box]] : [])].map(([key, label, Icon]) => { const Glyph = Icon as typeof Box; return <a key={String(key)} href={`#/${key}`} aria-current={page === key ? 'page' : undefined} onClick={event => { event.preventDefault(); navigate(String(key)); }}><Glyph size={16} aria-hidden="true" />{String(label)}</a>; })}</nav>
      <div className="header-actions"><Button variant="ghost" asChild><a href="#/settings" aria-current={page === 'settings' ? 'page' : undefined} onClick={event => { event.preventDefault(); navigate('settings'); }}><SettingsIcon aria-hidden="true" />Settings</a></Button></div>
      <h1 className="sr-only">{({ solve: 'Solve', cross: 'Cross Trainer', insights: 'Insights', settings: 'Settings', debug: 'Debug' })[page]}</h1>
    </header>
    <div className="workspace">
      {(contentPage === 'solve' || contentPage === 'insights') && <aside><TimedHistory repository={repository} refreshKey={savedAttempt ?? undefined} compact /></aside>}
      {contentPage === 'cross' && <aside ref={setCrossHistoryTarget} />}
      <div className="page-content">
        {contentPage === 'insights' && <section aria-label="Insights" className="insights-panel"><Tabs defaultValue="Overview"><TabsList aria-label="Insights views" variant="line">{['Overview', 'Graphs', 'Results'].map(tab => <TabsTrigger value={tab} key={tab}>{tab}</TabsTrigger>)}</TabsList>{['Overview', 'Graphs', 'Results'].map(tab => <TabsContent value={tab} key={tab}><h2>{tab}</h2><p className="insights-empty-state">{tab === 'Graphs' ? 'Progress graphs are not available yet.' : tab === 'Overview' ? 'Review your saved timed results. Averages and milestones are not available yet.' : 'Select a result to review and edit its saved details.'}</p></TabsContent>)}</Tabs></section>}
        {settings?.debug && <div hidden={page !== 'debug'} className="debug-page" data-step={debugStep}>
          <Tabs value={String(debugStep)} onValueChange={value => setDebugStep(Number(value))}>
            <TabsList aria-label="Diagnostic sections" variant="line">{['Connection', 'State', 'Evidence', 'Viewer traces', 'Cross cases'].map((label, i) => <TabsTrigger key={label} value={String(i + 1)}>{label}</TabsTrigger>)}</TabsList>
            <TabsContent value={String(Math.min(debugStep, 3))} forceMount hidden={debugStep > 3}><App sharedSession={session} bluetoothAvailable={bluetoothAvailable} /></TabsContent>
            <TabsContent value="4"><section aria-label="Viewer traces"><h2>Viewer traces</h2><p>{session.timingBasis}</p><p>Gyro quaternion: {JSON.stringify(snapshot.orientation)}</p><DiagnosticText label="Raw state" text={`Raw state: ${snapshot.facelets ?? 'No tracked state available'}`} /><Button onClick={downloadTrace}>Download viewer trace</Button></section></TabsContent>
            <TabsContent value="5"><CrossCases /></TabsContent>
          </Tabs>
        </div>}

        {(contentPage === 'solve' || contentPage === 'cross') && <section className="practice-workspace" data-phase={contentPage === 'cross' ? session.cross?.phase : timed?.phase} aria-label={contentPage === 'cross' ? 'Cross workspace' : 'Solve workspace'}>
          <div className="practice-sequence">
            {contentPage === 'cross' && session.cross && <SharedCrossScramble caseData={session.cross.case}>
              {session.cross.phase === 'setup' && preparation?.guide ? <GuidanceSteps guide={preparation.guide} status={preparation.status} crossColor={session.cross.case.color} mirrored={settings?.mirroredCrossInstructions !== false} /> : undefined}
            </SharedCrossScramble>}
            {(contentPage === 'cross' ? session.cross?.phase === 'ready' : timed?.phase === 'ready' || timed?.phase === 'inspection') && <h2 className="start-title" aria-live="polite">You may start</h2>}
            {recoveryError && <p role="alert">{recoveryError} <Button onClick={retryRecovery}>Retry interrupted attempt recovery</Button></p>}
            {(error || session.error) && <p role="alert">{error || session.error}{error && !preparation && !timed && <Button variant="outline" onClick={() => setError(null)}>Retry preparation</Button>}</p>}
            {!bluetoothAvailable && <p role="alert">Web Bluetooth requires Chrome or Edge on HTTPS or localhost.</p>}

            {preparation?.status === 'loading' && <p role="status">{preparation.loadingStage === 'solving' ? 'Computing setup… Keep cube still.' : 'Preparing… Keep cube still.'}</p>}
            {preparation?.error && <p role="alert">{preparation.error}</p>}
            {preparation?.guide && !session.cross && timed?.phase !== 'active' && timed?.phase !== 'completed' && timed?.phase !== 'interrupted' && <GuidanceSteps guide={preparation.guide} status={preparation.status} />}
            {session.cross?.phase !== 'setup' && session.cross?.guidance && <CrossTrainingGuidance cross={session.cross} mirrored={settings?.mirroredCrossInstructions !== false} />}
          </div>
          <CubeView facelets={snapshot.facelets} orientation={session.orientation} turns={snapshot.turns} showFaceLabels={!!settings?.showFaceLabels} locked3dMode={!!settings?.locked3dMode} defaultAngle={settings?.defaultAngle ?? DEFAULT_VIEW_ANGLE} viewResetVersion={session.viewResetVersion} />
          {contentPage === 'solve' && <SolveTiming session={session} />}
          {contentPage === 'cross' && <div ref={setCrossFeedbackTarget} />}

        </section>}
      </div>
      <aside className="controls-sidebar" aria-label="Tab controls">
        <section className="controls-panel" aria-label="Cube controls">
          <h2>Cube</h2>
          <Button className="cube-connection" variant="outline" data-connected={session.status === 'connected'} disabled={session.status === 'connecting' || (session.status === 'disconnected' && (!bluetoothAvailable || !session.canConnect))} onClick={() => {
            if (session.status === 'connected') { openDevice(); void session.request('REQUEST_BATTERY'); }
            else { setError(null); void session.connect(); }
          }}><Bluetooth aria-hidden="true" />{session.status === 'connected' ? 'Connected' : session.status === 'connecting' ? 'Connecting...' : 'Connect Cube'}</Button>

          <div className="practice-actions">
            {contentPage === 'solve' && preparation && <Button variant="ghost" disabled={timed?.saveState === 'pending' || (timed?.saveState === 'failed' && !!timed.result)} onClick={() => session.cancelPreparation()}>{timed?.phase === 'active' ? 'Abandon solve (DNF)' : timed?.phase === 'completed' || timed?.phase === 'interrupted' ? 'Next scramble' : 'Cancel preparation'}</Button>}
            {contentPage === 'solve' && !preparation && timed?.result && <Button disabled={timed.saveState !== 'saved'} onClick={() => session.cancelPreparation()}>Next scramble</Button>}
          </div>
        </section>
        <div hidden={contentPage !== 'cross'} className="cross-controls"><FreeCrossPractice enabled={contentPage === 'cross' && !deviceOpen} session={session} repository={repository} sessionReady={sessionReady && recoveryReady} generate={generateCross} solve={solveSetup} compact historyTarget={crossHistoryTarget} feedbackTarget={crossFeedbackTarget} mirrored={settings?.mirroredCrossInstructions !== false} /></div>
      </aside>
    </div>
    <Overlay open={deviceOpen} onOpenChange={open => { setDeviceOpen(open); if (!open && session.solvedResetPending) session.cancelSolvedReset(); }} title="Device" size="small"><DeviceControls key={session.solvedResetVersion} session={session} bluetoothAvailable={bluetoothAvailable} confirm={confirm} /></Overlay>
    <Overlay open={page === 'settings'} onOpenChange={open => { if (!open) navigate('solve'); }} title="Settings" size="wide"><LocalSessions repository={repository} onReady={setSessionReady} onSettings={setSettings} facelets={snapshot.facelets} orientation={session.orientation} /></Overlay>
  </main>;
}
