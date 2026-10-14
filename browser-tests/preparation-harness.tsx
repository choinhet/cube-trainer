import { createRoot } from 'react-dom/client';
import { LiveApp } from '../src/app/LiveApp';
import type { GanCubeEvent } from 'gan-web-bluetooth';
import type { Connection } from '../src/domain/session';
import { SOLVED, turn } from '../src/domain/cube';
import type { PracticeScramble } from '../src/domain/scramble';
import { requestPracticeScramble } from '../src/workers/scramble-client';
import type { SetupSolver } from '../src/domain/setup';

export function mount(source = SOLVED, solveSetup?: SetupSolver, generateScramble?: (signal: AbortSignal) => Promise<PracticeScramble>): ((move: string) => void) & { exercise(): PracticeScramble | null } {
  let exercise: PracticeScramble | null = null;
  const generate = async (signal: AbortSignal): Promise<PracticeScramble> => { const generated = await (generateScramble ?? requestPracticeScramble)(signal); if (!signal.aborted) exercise ??= generated; return generated; };
  let next: (event: GanCubeEvent) => void = () => {};
  let serial = 10;
  let facelets = source;
  const connection: Connection = {
    deviceName: 'Synthetic browser cube',
    events$: { subscribe: observer => { next = observer.next; return { unsubscribe: () => {} }; } },
    sendCubeCommand: async () => next({ type: 'FACELETS', timestamp: 1, serial, facelets, state: { CP: [], CO: [], EP: [], EO: [] } }),
    disconnect: async () => {},
  };
  // A separate root keeps the ordinary app and its IndexedDB initialization isolated.
  document.getElementById('root')!.remove();
  const container = document.createElement('div'); document.body.append(container);
  createRoot(container).render(<LiveApp connectCube={async () => connection} bluetoothAvailable solveSetup={solveSetup} generateScramble={generate} />);
  const physical = (move: string): void => {
    facelets = turn(facelets, move);
    next({ type: 'MOVE', timestamp: performance.now(), serial: ++serial, move, face: 'URFDLB'.indexOf(move[0]), direction: move.endsWith("'") ? 1 : 0, localTimestamp: performance.now(), cubeTimestamp: null });
  };
  return Object.assign(physical, { exercise: () => exercise });
}
