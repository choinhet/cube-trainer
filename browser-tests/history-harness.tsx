import { createRoot } from 'react-dom/client';
import { TimedHistory } from '../src/features/history/TimedHistory';
import { LiveApp } from '../src/app/LiveApp';
import { LocalRepository } from '../src/adapters/local-repository';
import type { Penalty } from '../src/domain/timed-attempt';
export async function mount(failure: 'edit' | 'delete' | null = null, canceledConnection = false): Promise<void> {
  class HistoryRepository extends LocalRepository {
    override editTimedPenalty(id: string, penalty: Penalty): Promise<void> {
      return failure === 'edit' ? Promise.reject(new Error('Synthetic history write failure')) : super.editTimedPenalty(id, penalty);
    }
    override deleteTimedResult(id: string): Promise<void> {
      return failure === 'delete' ? Promise.reject(new Error('Synthetic history delete failure')) : super.deleteTimedResult(id);
    }
  }
  const repository = new HistoryRepository();
  if (!(await repository.listTimedResults()).length) {
    const historical = await repository.createSession('Historical practice', 1);
    const current = await repository.createSession('Current practice', 2);
    const basis = { status: 'completed' as const, rawDurationMs: 1234.567, penalty: 'none' as const, timingBasis: 'host-monotonic-receipt' as const };
    await repository.saveTimedResult({ ...basis, id: 'first', sessionId: historical.id, startedAt: 1000 });
    await repository.saveTimedResult({ ...basis, id: 'second', sessionId: current.id, startedAt: 2000 });
    await repository.saveTimedResult({ ...basis, id: 'interrupt', status: 'interrupted', sessionId: historical.id, startedAt: 3000, rawDurationMs: 987.654, solveStarted: true, reason: 'Disconnected' });
  }
  document.getElementById('root')!.remove();
  const container = document.createElement('div'); document.body.append(container);
  createRoot(container).render(canceledConnection ? <LiveApp repository={repository} bluetoothAvailable connectCube={async () => { throw new DOMException('Chooser canceled', 'NotFoundError'); }} /> : <TimedHistory repository={repository} />);
}
