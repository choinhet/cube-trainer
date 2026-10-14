import { expect, it, vi } from 'vitest';
import { ExerciseQueue } from './exercise-queue';

it('generates one case ahead and consumes the cached case without waiting for another generation', async () => {
  const generate = vi.fn(async () => ({ id: generate.mock.calls.length }));
  const queue = new ExerciseQueue(generate);
  queue.warm();
  await vi.waitFor(() => expect(generate).toHaveBeenCalledOnce());
  expect(await queue.take(new AbortController().signal)).toEqual({ id: 1 });
  await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(2));
  expect(await queue.take(new AbortController().signal)).toEqual({ id: 2 });
  queue.dispose();
});

it('cancelling a consumer does not discard the next case', async () => {
  let finish!: (value: string) => void;
  const queue = new ExerciseQueue(() => new Promise<string>(resolve => { finish = resolve; }));
  const controller = new AbortController();
  const take = queue.take(controller.signal);
  await Promise.resolve();
  controller.abort();
  await expect(take).rejects.toThrow('cancelled');
  finish('cached');
  expect(await queue.take(new AbortController().signal)).toBe('cached');
  queue.dispose();
});

it('allows retry after background generation fails and aborts obsolete work', async () => {
  const generate = vi.fn<(signal: AbortSignal) => Promise<string>>().mockRejectedValueOnce(new Error('worker failed')).mockResolvedValue('retry');
  const queue = new ExerciseQueue(generate);
  queue.warm();
  await expect(queue.take(new AbortController().signal)).rejects.toThrow('worker failed');
  expect(await queue.take(new AbortController().signal)).toBe('retry');
  queue.dispose();
  expect(generate.mock.calls[0][0].aborted).toBe(true);
  await expect(queue.take(new AbortController().signal)).rejects.toThrow('cancelled');
});
