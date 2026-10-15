import { createRoot } from 'react-dom/client';
import type { GanCubeEvent } from 'gan-web-bluetooth';
import { LiveApp } from '../src/app/LiveApp';
import type { Connection } from '../src/domain/session';
import { SOLVED, turn } from '../src/domain/cube';
import { validateScramble } from '../src/domain/scramble';
import { LocalRepository } from '../src/adapters/local-repository';
import type { TimedResult, AttemptCheckpoint } from '../src/domain/timed-attempt';
export function mount(failure: 'checkpoint' | 'finalize' | null = null, scramble = 'R2'): ((move: string, hostMs: number, recovered?: boolean) => void) & { enableWrites(): void; generatedCount(): number } {
  class TestRepository extends LocalRepository {
    override saveCheckpoint(value: AttemptCheckpoint): Promise<void> {
      return failure === 'checkpoint' ? Promise.reject(new Error('Synthetic checkpoint write failure')) : super.saveCheckpoint(value);
    }
    override finalizeTimedAttempt(value: TimedResult): Promise<void> {
      return failure === 'finalize' ? Promise.reject(new Error('Synthetic result write failure')) : super.finalizeTimedAttempt(value);
    }
  }
  let next: (event: GanCubeEvent) => void = () => {};
  let serial = 10, now = 0, facelets = SOLVED, generated = 0;
  const connection: Connection = {
    deviceName: 'Synthetic timed cube',
    events$: { subscribe: observer => { next = observer.next; return { unsubscribe: () => {} }; } },
    sendCubeCommand: async () => next({ type: 'FACELETS', timestamp: 1, serial, facelets, state: { CP: [], CO: [], EP: [], EO: [] } }),
    disconnect: async () => {},
  };
  document.getElementById('root')!.remove();
  const container = document.createElement('div'); document.body.append(container);
  createRoot(container).render(<LiveApp repository={new TestRepository()} connectCube={async () => connection} bluetoothAvailable generateScramble={async () => { generated++; return validateScramble(scramble); }} monotonicClock={() => now} wallClock={() => 1791850000000} />);
  const physical = (move: string, hostMs: number, recovered = false): void => {
    now = hostMs; facelets = turn(facelets, move);
    next({ type: 'MOVE', timestamp: -99, serial: ++serial, move, face: 'URFDLB'.indexOf(move[0]), direction: move.endsWith("'") ? 1 : 0, localTimestamp: recovered ? null : -99, cubeTimestamp: null });
  };
  return Object.assign(physical, { enableWrites: () => { failure = null; }, generatedCount: () => generated });
}
