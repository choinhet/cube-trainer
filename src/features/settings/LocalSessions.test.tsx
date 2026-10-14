// @vitest-environment jsdom
import { IDBFactory } from 'fake-indexeddb';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LocalRepository } from '../../adapters/local-repository';
import { LocalSessions } from './LocalSessions';
import { SessionPicker } from './SessionPicker';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('keeps settings limited to preferences and preserves the saved timezone', async () => {
  const repository = new LocalRepository(new IDBFactory()); await repository.initialize();
  await repository.saveSettings({ reportingTimezone: 'UTC', inspection: false, debug: false });
  const settings = vi.fn();
  render(<LocalSessions repository={repository} onReady={() => {}} onSettings={settings} />);
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Enable Debug' }));
  await waitFor(async () => expect((await repository.load()).settings).toMatchObject({ reportingTimezone: 'UTC', debug: true }));
  expect(screen.queryByLabelText('New session name')).toBeNull();
  expect(screen.queryByLabelText('Current session')).toBeNull();
  expect(screen.queryByLabelText('Reporting timezone')).toBeNull();
  const faceLabels = screen.getByRole('checkbox', { name: /Show cube face labels/ });
  expect((faceLabels as HTMLInputElement).checked).toBe(false);
  fireEvent.click(faceLabels);
  await waitFor(async () => expect((await repository.load()).settings).toMatchObject({ reportingTimezone: 'UTC', debug: true, showFaceLabels: true }));
});

it('defaults bottom-cross instructions on and persists an explicit opt-out across reopening', async () => {
  const repository = new LocalRepository(new IDBFactory());
  await repository.initialize();
  await repository.saveSettings({ reportingTimezone: 'UTC' });
  render(<LocalSessions repository={repository} onReady={() => {}} onSettings={() => {}} />);
  const checkbox = await screen.findByRole('checkbox', { name: 'Mirrored instructions for the cross trainer' });
  expect((checkbox as HTMLInputElement).checked).toBe(true);
  fireEvent.click(checkbox);
  await waitFor(async () => expect((await repository.load()).settings.mirroredCrossInstructions).toBe(false));
  cleanup(); repository.close();
  render(<LocalSessions repository={repository} onReady={() => {}} onSettings={() => {}} />);
  expect(((await screen.findByRole('checkbox', { name: 'Mirrored instructions for the cross trainer' })) as HTMLInputElement).checked).toBe(false);
});

it('restores the checkbox and saved preference when a settings write fails', async () => {
  const repository = new LocalRepository(new IDBFactory());
  await repository.initialize();
  vi.spyOn(repository, 'saveSettings').mockRejectedValueOnce(new Error('Storage blocked'));
  const onSettings = vi.fn();
  render(<LocalSessions repository={repository} onReady={() => {}} onSettings={onSettings} />);
  const checkbox = await screen.findByRole('checkbox', { name: 'Mirrored instructions for the cross trainer' });
  fireEvent.click(checkbox);
  expect((await screen.findByRole('alert')).textContent).toContain('Storage blocked');
  expect((checkbox as HTMLInputElement).checked).toBe(true);
  expect((await repository.load()).settings.mirroredCrossInstructions).toBe(true);
  expect(onSettings).toHaveBeenCalledOnce();
});
it('creates sessions in a dialog and preserves committed selection on failed writes', async () => {
  const repository = new LocalRepository(new IDBFactory()); await repository.initialize();
  render(<SessionPicker repository={repository} />);
  await screen.findByRole('option', { name: 'Default' });
  fireEvent.change(screen.getByLabelText('History session'), { target: { value: '__new_session__' } });
  expect(screen.getByRole('dialog', { name: 'New session' })).toBeTruthy();
  fireEvent.change(screen.getByLabelText('New session name'), { target: { value: 'First' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create session' }));
  await screen.findByRole('option', { name: 'First' });
  expect(screen.queryByRole('dialog')).toBeNull();
  const before = await repository.load();
  vi.spyOn(repository, 'createSession').mockRejectedValueOnce(new Error('Quota exceeded'));
  fireEvent.change(screen.getByLabelText('History session'), { target: { value: '__new_session__' } });
  fireEvent.change(screen.getByLabelText('New session name'), { target: { value: 'Second' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create session' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Quota exceeded');
  expect(await repository.load()).toEqual(before);
  fireEvent.click(screen.getByRole('button', { name: 'Create session' }));
  await screen.findByRole('option', { name: 'Second' });
  expect((await repository.load()).sessions.map(session => session.name)).toEqual(['Default', 'First', 'Second']);
});
it('shows restoration errors and retries storage', async () => {
  const repository = new LocalRepository(new IDBFactory());
  vi.spyOn(repository, 'load').mockRejectedValueOnce(new Error('Storage denied'));
  render(<LocalSessions repository={repository} onReady={() => {}} onSettings={() => {}} />);
  expect((await screen.findByRole('alert')).textContent).toContain('could not be restored');
  fireEvent.click(screen.getByRole('button', { name: 'Retry local storage' }));
  await screen.findByRole('checkbox', { name: 'Enable Debug' });
  expect(screen.queryByRole('alert')).toBeNull();
});
