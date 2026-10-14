import type { LiveSession } from '../../app/live-session';
import { Button } from '../../components/ui/button';
import { useState } from 'react';
export function DeviceControls({ session, bluetoothAvailable, confirm }: { session: LiveSession; bluetoothAvailable: boolean; confirm: (action: () => void) => void }) {
  const snapshot = session.diagnostic.snapshot();
  const battery = session.diagnostic.trace().map(entry => entry.event).reverse().find(event => event.type === 'BATTERY');
  const [checked, setChecked] = useState(false);
  return <div className="device-controls">
    <p>{session.deviceName ?? 'No cube connected'} · {session.status === 'connected' ? 'Connected' : session.status}</p>
    <p>Battery: {battery?.type === 'BATTERY' ? `${battery.batteryLevel}%` : 'Unavailable'}</p>
    <div className="buttons">{session.status === 'disconnected' && <Button disabled={!bluetoothAvailable || !session.canConnect} onClick={() => void session.connect()}>Connect Cube</Button>}<Button variant="outline" disabled={session.status !== 'connected'} onClick={() => void session.disconnect()}>Disconnect</Button></div>
    <hr />
    <div className="buttons"><Button variant="outline" disabled={!session.canReset || !snapshot.orientation} onClick={() => confirm(() => session.resetGyro())}>Reset gyro (U4)</Button><Button variant="outline" disabled={!session.canReset} onClick={() => confirm(() => session.requestSolvedReset())}>Reset cube state (D4)</Button></div>
    {session.solvedResetPending && <div role="group" aria-label="Solved state confirmation" key={session.solvedResetVersion}><p>Physically solve every face before resetting the cube state.</p><label><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} />I have physically solved the cube</label><div className="buttons"><Button disabled={!checked || !session.canReset} onClick={() => confirm(() => session.confirmPhysicallySolved())}>Confirm solved cube</Button><Button variant="outline" onClick={() => session.cancelSolvedReset()}>Cancel</Button></div></div>}
    {(session.error || snapshot.reason) && <p role="alert">{session.error || snapshot.reason}</p>}
  </div>;
}
