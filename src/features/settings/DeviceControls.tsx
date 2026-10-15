import type { LiveSession } from '../../app/live-session';
import { Button } from '../../components/ui/button';
import { ActionBar, Disclosure, FieldRow, Metric, MetricGroup, ModalSection } from '../../components/ModalPatterns';
import { useState } from 'react';
export function DeviceControls({ session, bluetoothAvailable, confirm }: { session: LiveSession; bluetoothAvailable: boolean; confirm: (action: () => void) => void }) {
  const snapshot = session.diagnostic.snapshot();
  const battery = session.diagnostic.trace().map(entry => entry.event).reverse().find(event => event.type === 'BATTERY');
  const [checked, setChecked] = useState(false);
  return <div className="device-controls">
    <ModalSection title="Connection">
      <MetricGroup><Metric label="Cube" value={session.deviceName ?? 'No cube connected'} /><Metric label="Status" value={<span role="status">{session.status === 'connected' ? 'Connected' : session.status}</span>} /><Metric label="Battery" value={battery?.type === 'BATTERY' ? `${battery.batteryLevel}%` : 'Unavailable'} /></MetricGroup>
      {!bluetoothAvailable && <p>Bluetooth is unavailable in this browser. Use a browser with Web Bluetooth support to connect a cube.</p>}
      {session.status === 'connecting' && <p role="status">Choose your cube in the Bluetooth device picker. You can cancel in that picker.</p>}
      <ActionBar>{session.status === 'disconnected' ? <Button disabled={!bluetoothAvailable || !session.canConnect} onClick={() => void session.connect()}>Connect Cube</Button> : <Button variant="outline" disabled={session.status !== 'connected'} onClick={() => void session.disconnect()}>Disconnect</Button>}</ActionBar>
      {(session.error || snapshot.reason) && <p role="alert">{session.error || snapshot.reason}</p>}
    </ModalSection>
    <Disclosure title="Cube calibration" defaultOpen>
      <p>Reset only when the cube is connected and practice is idle.</p>
      <ActionBar destructive><Button variant="outline" disabled={!session.canReset || !snapshot.orientation} onClick={() => confirm(() => session.resetGyro())}>Reset gyro (U4)</Button><Button variant="outline" disabled={!session.canReset} onClick={() => confirm(() => session.requestSolvedReset())}>Reset cube state (D4)</Button></ActionBar>
      {session.solvedResetPending && <div role="group" aria-label="Solved state confirmation" key={session.solvedResetVersion}><p>Physically solve every face before resetting the cube state.</p><FieldRow><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} />I have physically solved the cube</FieldRow><ActionBar><Button variant="outline" onClick={() => session.cancelSolvedReset()}>Cancel</Button><Button disabled={!checked || !session.canReset} onClick={() => confirm(() => session.confirmPhysicallySolved())}>Confirm solved cube</Button></ActionBar></div>}
    </Disclosure>
  </div>;
}
