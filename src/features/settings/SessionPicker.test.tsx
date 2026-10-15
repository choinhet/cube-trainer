// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { LocalRepository } from '../../adapters/local-repository';
import { SessionPicker } from './SessionPicker';
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
afterEach(cleanup);
it('prevents repeated form submission and retains the draft after a failed write', async () => {
  const repository = new LocalRepository(new IDBFactory()); await repository.initialize();
  let reject!: (cause: Error) => void;
  const create = vi.spyOn(repository, 'createSession').mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
  render(<SessionPicker repository={repository} />);
  await screen.findByRole('option', { name: 'Default' });
  fireEvent.change(screen.getByLabelText('History session'), { target: { value: '__new_session__' } });
  fireEvent.change(screen.getByLabelText('New session name'), { target: { value: 'Morning practice' } });
  const form = screen.getByRole('form', { name: 'New session' });
  fireEvent.submit(form); fireEvent.submit(form);
  expect(create).toHaveBeenCalledTimes(1);
  reject(new Error('Storage blocked'));
  expect((await screen.findByRole('alert')).textContent).toContain('Storage blocked');
  expect((screen.getByLabelText('New session name') as HTMLInputElement).value).toBe('Morning practice');
});

it('restores the session picker after Escape from its automatically focused name field', async () => {
  const repository = new LocalRepository(new IDBFactory()); await repository.initialize();
  render(<SessionPicker repository={repository} />);
  const picker = await screen.findByRole('combobox', { name: 'History session' });
  picker.focus();
  fireEvent.change(picker, { target: { value: '__new_session__' } });
  const name = screen.getByLabelText('New session name');
  fireEvent.keyDown(name, { key: 'Escape' });
  await screen.findByRole('combobox', { name: 'History session' });
  expect(document.activeElement).toBe(picker);
});
