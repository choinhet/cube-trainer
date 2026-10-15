// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { FreeCrossPractice } from './FreeCrossPractice';
import { LocalRepository } from '../../adapters/local-repository';
import { CrossRepository } from '../../adapters/cross-repository';
import * as crossClient from '../../workers/cross-client';
import type { CrossPracticeController } from '../../domain/cross-practice';
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('cancels pending import on dismissal, prevents repeats and retains input for recovery', async () => {
  vi.spyOn(CrossRepository.prototype, 'recoverInterruptedAttempts').mockResolvedValue(0);
  vi.spyOn(CrossRepository.prototype, 'list').mockResolvedValue([]);
  let signal!: AbortSignal;
  const importing = vi.spyOn(crossClient, 'requestImportedCrossCase').mockImplementation((_text, _color, nextSignal) => { signal = nextSignal; return new Promise((_resolve, reject) => { nextSignal.addEventListener('abort', () => reject(new Error('Cancelled'))); }); });
  const session = { cross: null, canPractice: true, activity: 'idle', preparation: null, replaceCrossPreparation: vi.fn(), requireResynchronization: vi.fn() } as unknown as CrossPracticeController;
  const repository = new LocalRepository(new IDBFactory()); await repository.initialize();
  render(<FreeCrossPractice session={session} repository={repository} sessionReady enabled={false} />);
  fireEvent.click(screen.getByRole('button', { name: 'Import shared scramble' }));
  fireEvent.change(screen.getByLabelText('Shared scramble'), { target: { value: 'R U2' } });
  await waitFor(() => expect((screen.getByRole('button', { name: 'Use scramble' }) as HTMLButtonElement).disabled).toBe(false));
  const form = screen.getByLabelText('Shared scramble').closest('form')!;
  fireEvent.submit(form); fireEvent.submit(form);
  expect(importing).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(signal.aborted).toBe(true);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(session.replaceCrossPreparation).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Import shared scramble' }));
  expect((screen.getByLabelText('Shared scramble') as HTMLTextAreaElement).value).toBe('R U2');
  importing.mockRejectedValueOnce(new Error('Invalid scramble'));
  fireEvent.change(screen.getByLabelText('Cross color'), { target: { value: 'blue' } });
  fireEvent.submit(screen.getByLabelText('Shared scramble').closest('form')!);
  expect((await screen.findByRole('alert')).textContent).toContain('Check the scramble and try again');
  expect((screen.getByLabelText('Shared scramble') as HTMLTextAreaElement).value).toBe('R U2');
  expect((screen.getByLabelText('Cross color') as HTMLSelectElement).value).toBe('blue');
});


