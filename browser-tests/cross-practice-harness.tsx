import { createRoot } from 'react-dom/client';
import type { GanCubeEvent } from 'gan-web-bluetooth';
import { LiveApp } from '../src/app/LiveApp';
import type { Connection } from '../src/domain/session';
import { SOLVED, turn } from '../src/domain/cube';
import { LocalRepository } from '../src/adapters/local-repository';
import type { CrossCase } from '../src/domain/cross';
export function mount(failure: 'checkpoint' | 'finalize' | null = null, scramble = 'R2', sourceAlgorithm = ''): ((move: string, hostMs: number) => void) & { enableWrites(): void; generatedCount(): number } {
  class TestRepository extends LocalRepository {
    override transaction<T>(stores: string[], mode: IDBTransactionMode, work: (tx: IDBTransaction) => () => T): Promise<T> {
      const fail = mode === 'readwrite' && stores.includes('sessions') && (failure === 'checkpoint' ? stores[0] === 'crossCheckpoints' : failure === 'finalize' ? stores[0] === 'crossAttempts' : false);
      return fail ? Promise.reject(new Error(`Synthetic cross ${failure} write failure`)) : super.transaction(stores, mode, work);
    }
  }
  let next: (event: GanCubeEvent) => void = () => {};
  const source = sourceAlgorithm ? sourceAlgorithm.split(' ').reduce(turn, SOLVED) : SOLVED;
  let serial = 10, now = 0, facelets = source, generated = 0;
  const connection: Connection = { deviceName: 'Synthetic free cross cube', events$: { subscribe: observer => { next = observer.next; return { unsubscribe: () => {} }; } }, sendCubeCommand: async () => next({ type: 'FACELETS', timestamp: 1, serial, facelets, state: { CP: [], CO: [], EP: [], EO: [] } }), disconnect: async () => {} };
  const caseData: CrossCase = { caseId: scramble === 'R2' ? 'browser-r2' : `browser-${scramble}`, startingState: scramble.split(' ').reduce(turn, source), originalScramble: scramble, ...(sourceAlgorithm ? { scrambleSource: source } : {}), color: 'white', optimum: scramble.split(' ').length };
  document.getElementById('root')!.remove();
  const container = document.createElement('div'); document.body.append(container);
  createRoot(container).render(<LiveApp repository={new TestRepository()} connectCube={async () => connection} bluetoothAvailable generateCross={async () => { generated++; return caseData; }} monotonicClock={() => now} wallClock={() => 1791850000000} />);
  const physical = (move: string, hostMs: number): void => {
    now = hostMs; facelets = turn(facelets, move);
    next({ type: 'MOVE', timestamp: -99, serial: ++serial, move, face: 'URFDLB'.indexOf(move[0]), direction: move.endsWith("'") ? 1 : 0, localTimestamp: -99, cubeTimestamp: null });
  };
  return Object.assign(physical, { enableWrites: () => { failure = null; }, generatedCount: () => generated });
}
