// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CrossCases } from './CrossCases';
import { CrossClient } from '../../workers/cross-client';

class FakeWorker {
  static latest: FakeWorker;
  onmessage?: (event: MessageEvent) => void;
  onerror?: (event: { message: string }) => void;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() { FakeWorker.latest = this; }
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('worker loading and errors remain visible without substituting difficulty', async () => {
  vi.stubGlobal('Worker', FakeWorker);
  render(<CrossCases />);
  expect((screen.getByLabelText('Cross color') as HTMLSelectElement).value).toBe('white');
  fireEvent.change(screen.getByLabelText('Exact difficulty'), { target: { value: '8' } });
  fireEvent.click(screen.getByRole('button', { name: 'Generate cross case' }));
  expect(screen.getByRole('status').textContent).toContain('worker');
  expect(FakeWorker.latest.postMessage).toHaveBeenCalledWith({ id: 1, color: 'white', difficulty: 8 });
  FakeWorker.latest.onmessage!({ data: { id: 1, error: 'Exact table unavailable' } } as MessageEvent);
  expect((await screen.findByRole('alert')).textContent).toContain('Exact table unavailable');
  expect((screen.getByLabelText('Exact difficulty') as HTMLSelectElement).value).toBe('8');
  expect(FakeWorker.latest.postMessage).toHaveBeenCalledTimes(1);
});

test('closing client terminates worker and rejects outstanding requests', async () => {
  vi.stubGlobal('Worker', FakeWorker);
  const client = new CrossClient();
  const pending = client.generate('blue', 8);
  const rejection = expect(pending).rejects.toThrow('closed');
  client.dispose();
  await rejection;
  expect(FakeWorker.latest.terminate).toHaveBeenCalledOnce();
});
