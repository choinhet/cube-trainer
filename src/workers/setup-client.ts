import { validateSetup, validateTarget, type ExerciseSetup, type SetupSolver } from '../domain/setup';

export const requestExerciseSetup: SetupSolver = (source, target, signal) => new Promise((resolve, reject) => {
  if (signal.aborted) { reject(new Error('Setup cancelled')); return; }
  validateTarget(target);
  const targetFacelets = target.target;
  const worker = new Worker(new URL('./setup.worker.ts', import.meta.url), { type: 'module' });
  let finished = false;
  const timeout = setTimeout(() => finish(new Error('Setup solving timed out. Cancel and try again.')), 60_000);
  const cancel = () => finish(new Error('Setup cancelled'));
  function finish(error?: Error, setup?: ExerciseSetup): void {
    if (finished) return;
    finished = true;
    clearTimeout(timeout);
    signal.removeEventListener('abort', cancel);
    worker.terminate();
    if (error) reject(error);
    else resolve(setup!);
  }
  signal.addEventListener('abort', cancel, { once: true });
  worker.onerror = event => finish(new Error(event.message || 'Setup worker failed'));
  worker.onmessage = (event: MessageEvent<{ setup?: ExerciseSetup; error?: string }>) => {
    try {
      if (event.data.error || !event.data.setup) throw new Error(event.data.error || 'Missing setup');
      finish(undefined, validateSetup(source, targetFacelets, event.data.setup));
    } catch (error) { finish(new Error(String(error))); }
  };
  worker.postMessage({ source, target });
});
