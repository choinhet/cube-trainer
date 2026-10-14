import type { CrossCase, CrossColor, CrossGraph, CrossMetrics, CrossQuery } from '../domain/cross';
import { importedCrossCase, parseSharedScramble } from '../domain/cross-import';

export type WorkerMetrics = CrossMetrics & { cachedTableBytes: number };
export class CrossClient {
  private worker?: Worker;
  private sequence = 0;
  private pending = new Map<number, { resolve: (value: { result: CrossCase | CrossQuery | CrossGraph; metrics: WorkerMetrics }) => void; reject: (error: Error) => void; timeout: ReturnType<typeof setTimeout> }>();
  private request(color: CrossColor, request: { difficulty?: number; state?: string; graph?: boolean }): Promise<{ result: CrossCase | CrossQuery | CrossGraph; metrics: WorkerMetrics }> {
    if (!this.worker) {
      this.worker = new Worker(new URL('./cross.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = event => {
        const pending = this.pending.get(event.data.id);
        if (!pending) return;
        clearTimeout(pending.timeout); this.pending.delete(event.data.id);
        if (event.data.error) pending.reject(new Error(event.data.error));
        else pending.resolve(event.data);
      };
      this.worker.onerror = event => this.dispose(event.message || 'Cross worker failed');
    }
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => this.dispose('Cross solver timed out. Try again.'), 30_000);
      this.pending.set(id, { resolve, reject, timeout });
      this.worker!.postMessage({ id, color, ...request });
    });
  }
  async generate(color: CrossColor, difficulty: number, state?: string): Promise<{ result: CrossCase; metrics: WorkerMetrics }> {
    return this.request(color, { difficulty, state }) as Promise<{ result: CrossCase; metrics: WorkerMetrics }>;
  }
  async query(color: CrossColor, state: string): Promise<{ result: CrossQuery; metrics: WorkerMetrics }> {
    return this.request(color, { state }) as Promise<{ result: CrossQuery; metrics: WorkerMetrics }>;
  }
  async graph(color: CrossColor, state: string, signal: AbortSignal): Promise<CrossGraph> {
    const cancel = () => this.dispose('Cross guidance cancelled');
    if (signal.aborted) throw new Error('Cross guidance cancelled');
    signal.addEventListener('abort', cancel, { once: true });
    try { return (await this.request(color, { state, graph: true })).result as CrossGraph; }
    finally { signal.removeEventListener('abort', cancel); }
  }
  dispose(message = 'Cross inspector closed'): void {
    this.worker?.terminate(); this.worker = undefined;
    this.pending.forEach(item => { clearTimeout(item.timeout); item.reject(new Error(message)); });
    this.pending.clear();
  }
}

export async function requestCrossCase(color: CrossColor, difficulty: number, signal: AbortSignal): Promise<CrossCase> {
  const client = new CrossClient();
  const cancel = () => client.dispose('Cross generation cancelled');
  if (signal.aborted) throw new Error('Cross generation cancelled');
  signal.addEventListener('abort', cancel, { once: true });
  try { return (await client.generate(color, difficulty)).result; }
  finally { signal.removeEventListener('abort', cancel); client.dispose(); }
}

export async function requestImportedCrossCase(text: string, color: CrossColor, signal: AbortSignal): Promise<CrossCase> {
  const scramble = parseSharedScramble(text);
  const client = new CrossClient();
  const cancel = () => client.dispose('Scramble import cancelled');
  if (signal.aborted) throw new Error('Scramble import cancelled');
  signal.addEventListener('abort', cancel, { once: true });
  try { return importedCrossCase(scramble, color, (await client.query(color, scramble.startingState)).result.distance); }
  finally { signal.removeEventListener('abort', cancel); client.dispose(); }
}
