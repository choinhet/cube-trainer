import { afterEach, expect, it, vi } from 'vitest';
import { requestExerciseSetup } from './setup-client';
import { SOLVED, turn } from '../domain/cube';
import { validateScramble } from '../domain/scramble';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
function workerHarness() {
  const worker = { postMessage: vi.fn(), terminate: vi.fn(), onmessage: null as null | ((event: { data: unknown }) => void), onerror: null as null | ((event: { message: string }) => void) };
  vi.stubGlobal('Worker', class { constructor() { return worker; } });
  return worker;
}
it('binds worker results to source and target and terminates after validation', async () => {
  const worker = workerHarness();
  const target = validateScramble('R U');
  const source = turn(SOLVED, 'R');
  const pending = requestExerciseSetup(source, target, new AbortController().signal);
  expect(worker.postMessage).toHaveBeenCalledWith({ source, target });
  worker.onmessage!({ data: { setup: { source, target: target.target, moves: ['U'] } } });
  expect((await pending).moves).toEqual(['U']);
  expect(worker.terminate).toHaveBeenCalledOnce();
});

it('binds validation to the requested target even if the caller later mutates its object', async () => {
  const worker = workerHarness();
  const target = validateScramble('U');
  const source = turn(SOLVED, 'R');
  const pending = requestExerciseSetup(source, target, new AbortController().signal);
  target.target = turn(SOLVED, 'F');
  worker.onmessage!({ data: { setup: { source, target: target.target, moves: ["R'", 'F'] } } });
  await expect(pending).rejects.toThrow('source and full target');
});

it.each(['source', 'target', 'moves', 'missing', 'error', 'worker error', 'cancel', 'timeout'])('rejects %s responses and cleans up the worker', async failure => {
  vi.useFakeTimers();
  const worker = workerHarness();
  const controller = new AbortController();
  const target = validateScramble('U');
  const source = turn(SOLVED, 'R');
  const pending = requestExerciseSetup(source, target, controller.signal);
  const rejected = expect(pending).rejects.toThrow();
  const setup = { source, target: target.target, moves: ["R'", 'U'] };
  if (failure === 'cancel') controller.abort();
  else if (failure === 'timeout') await vi.advanceTimersByTimeAsync(60_000);
  else if (failure === 'worker error') worker.onerror!({ message: 'Worker crashed' });
  else worker.onmessage!({ data: failure === 'missing' ? {} : failure === 'error' ? { error: 'Solver failed' } : { setup: { ...setup, ...(failure === 'source' ? { source: SOLVED } : failure === 'target' ? { target: SOLVED } : { moves: ['F'] }) } } });
  await rejected;
  expect(worker.terminate).toHaveBeenCalledOnce();
  controller.abort();
  expect(worker.terminate).toHaveBeenCalledOnce();
});
