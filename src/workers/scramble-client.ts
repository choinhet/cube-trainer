import { validateScramble, type PracticeScramble } from '../domain/scramble';
export function requestPracticeScramble(signal: AbortSignal): Promise<PracticeScramble> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error('Generation cancelled')); return; }
    const worker = new Worker(new URL('./scramble.worker.ts', import.meta.url), { type: 'module' });
    const timeout = setTimeout(() => finish(new Error('Scramble generation timed out. Cancel and try again.')), 60_000);
    const cancel = () => finish(new Error('Generation cancelled'));
    function finish(error?: Error, scramble?: PracticeScramble): void {
      clearTimeout(timeout);
      signal.removeEventListener('abort', cancel);
      worker.terminate();
      if (error) reject(error);
      else resolve(scramble!);
    }
    signal.addEventListener('abort', cancel, { once: true });
    worker.onerror = event => finish(new Error(event.message || 'Scramble worker failed'));
    worker.onmessage = (event: MessageEvent<{ scramble?: PracticeScramble; error?: string }>) => {
      try {
        if (event.data.error || !event.data.scramble) throw new Error(event.data.error || 'Missing scramble');
        const scramble = validateScramble(event.data.scramble.original);
        if (scramble.target !== event.data.scramble.target) throw new Error('Scramble target mismatch');
        finish(undefined, scramble);
      } catch (error) { finish(new Error(String(error))); }
    };
    worker.postMessage({ type: 'generate' });
  });
}
