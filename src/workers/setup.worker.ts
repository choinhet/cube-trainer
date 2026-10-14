import { computeSetup } from '../domain/setup-solver';
import type { ExerciseTarget } from '../domain/setup';

self.onmessage = async (event: MessageEvent<{ source: string; target: ExerciseTarget }>) => {
  try { self.postMessage({ setup: await computeSetup(event.data.source, event.data.target) }); }
  catch (error) { self.postMessage({ error: String(error) }); }
};
