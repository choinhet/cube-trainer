// @vitest-environment jsdom
import { IDBFactory } from 'fake-indexeddb';
import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TimedHistory } from './TimedHistory';
import { LocalRepository } from '../../adapters/local-repository';
import { SOLVED } from '../../domain/cube';
afterEach(cleanup);
it('reopens named last-layer algorithms offline alongside the original saved solve', async () => {
  const factory = new IDBFactory(); const repository = new LocalRepository(factory);
  const session = await repository.createSession('Algorithms');
  const moves = "R U R' R U R' U R U2 R' R U R' U' R' F R2 U' R' U' R U R' F' U".split(' ');
  await repository.saveTimedResult({ id: 'named', sessionId: session.id, status: 'completed', startedAt: 1000, rawDurationMs: 2400, penalty: 'none', timingBasis: 'host-monotonic-receipt', facelets: SOLVED, rawTurns: moves.map((move, serial) => ({ move, serial, hostMs: serial * 100, deviceMs: null })) });
  render(<TimedHistory repository={new LocalRepository(factory)} />);
  fireEvent.click(await screen.findByText('Algorithm details'));
  expect(screen.getByText('PLL - T')).toBeTruthy();
  expect(screen.queryByText(/estimated|reconstructed/i)).toBeNull();
  expect((await repository.listTimedResults())[0].rawTurns?.map(move => move.move)).toEqual(moves);
});
it('reopens offline F2L pair details with recognition and execution while keeping penalties separate', async () => {
  const factory = new IDBFactory(); const repository = new LocalRepository(factory);
  const session = await repository.createSession('Pairs');
  const moves = "R U R' L' U' L R' U' R L U L' U".split(' ');
  await repository.saveTimedResult({ id: 'pairs', sessionId: session.id, status: 'completed', startedAt: 1000, rawDurationMs: 1200, penalty: 'none', timingBasis: 'host-monotonic-receipt', facelets: SOLVED, rawTurns: moves.map((move, serial) => ({ move, serial, hostMs: serial * 100, deviceMs: null })) });
  render(<TimedHistory repository={new LocalRepository(factory)} />);
  const summary = await screen.findByText('F2L pair details');
  fireEvent.click(summary);
  const pairDetails = within(summary.closest('details')!);
  expect(screen.getByText('F2L pair 4')).toBeTruthy();
  expect(pairDetails.getAllByText('Recognition: 0.1 s')).toHaveLength(3);
  expect(pairDetails.getAllByText('Execution: 0.2 s')).toHaveLength(4);
  expect(within(screen.getByRole('group', { name: 'F2L phase' })).getAllByRole('button')).toHaveLength(7);
  fireEvent.click(screen.getByRole('button', { name: '+2' }));
  await screen.findByText('3.20 (+2)');
  expect(pairDetails.getAllByText('Execution: 0.2 s')).toHaveLength(4);
});
async function fixture() {
  const factory = new IDBFactory(); const repository = new LocalRepository(factory);
  const old = await repository.createSession('Old practice'); const current = await repository.createSession('Current practice');
  await repository.saveTimedResult({ id: 'old', sessionId: old.id, status: 'completed', startedAt: 1000, rawDurationMs: 1234.567, penalty: 'none', timingBasis: 'host-monotonic-receipt' });
  await repository.saveTimedResult({ id: 'interruption', sessionId: current.id, status: 'interrupted', startedAt: 2000, rawDurationMs: 0, penalty: 'none', solveStarted: false, reason: 'Disconnected', timingBasis: 'host-monotonic-receipt' });
  return { repository, factory };
}
it('reviews historical/current session context, edits penalty precisely and deletes durably without Bluetooth', async () => {
  const { repository, factory } = await fixture(); render(<TimedHistory repository={repository} />);
  await screen.findByText('Current practice (current session)');
  const rows = screen.getAllByRole('listitem');
  expect(within(rows[0]).getByText('Old practice (historical session)')).toBeTruthy();
  expect(within(rows[1]).getByText('Disconnected')).toBeTruthy();
  expect(within(rows[1]).queryByRole('combobox')).toBeNull();
  fireEvent.click(within(rows[0]).getByRole('button', { name: '+2' }));
  await screen.findByText('3.23 (+2)');
  expect((await new LocalRepository(factory).listTimedResults())[0].rawDurationMs).toBe(1234.567);
  fireEvent.click(within(rows[0]).getByRole('button', { name: 'DNF' }));
  await screen.findByText('DNF (1.23)');
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
  fireEvent.click(within(rows[0]).getByRole('button', { name: 'Delete result' }));
  await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));
  expect(await new LocalRepository(factory).listTimedResults()).toEqual([expect.objectContaining({ id: 'interruption' })]);
});
it('failed writes retain persisted presentation and external commits refresh the view', async () => {
  const { repository, factory } = await fixture(); render(<TimedHistory repository={repository} />);
  await screen.findByText('1.23'); const row = screen.getAllByRole('listitem')[0];
  vi.spyOn(repository, 'editTimedPenalty').mockRejectedValue(new Error('Quota exceeded'));
  fireEvent.click(within(row).getByRole('button', { name: '+2' }));
  await screen.findByText(/Penalty was not saved.*Quota exceeded/);
  expect(screen.getByText('1.23')).toBeTruthy();
  vi.spyOn(repository, 'deleteTimedResult').mockRejectedValue(new Error('Delete blocked'));
  fireEvent.click(within(row).getByRole('button', { name: 'Delete result' }));
  await screen.findByText(/Result was not deleted.*Delete blocked/); expect(screen.getAllByRole('listitem')).toHaveLength(2);
  const sibling = new LocalRepository(factory); await sibling.editTimedPenalty('old', '+2');
  await screen.findByText('3.23 (+2)');
});

it('keeps the saved row visible until a delete transaction commits', async () => {
  const { repository } = await fixture(); render(<TimedHistory repository={repository} />);
  await screen.findByText('1.23');
  const original = repository.deleteTimedResult.bind(repository);
  let commit!: () => void;
  vi.spyOn(repository, 'deleteTimedResult').mockImplementation(id => new Promise<void>((resolve, reject) => {
    commit = () => { void original(id).then(resolve, reject); };
  }));
  fireEvent.click(within(screen.getAllByRole('listitem')[0]).getByRole('button', { name: 'Delete result' }));
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
  expect(screen.getByText('1.23')).toBeTruthy();
  commit(); await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));
});

it('automatically saves both penalty toggles, toggles them off, and formats the reporting date', async () => {
  const { repository } = await fixture(); render(<TimedHistory repository={repository} />);
  await screen.findByText('1.23');
  const row = screen.getAllByRole('listitem')[0];
  const plusTwo = within(row).getByRole('button', { name: '+2' });
  const dnf = within(row).getByRole('button', { name: 'DNF' });
  expect(row.querySelector('time')?.textContent).toContain('Dec 31, 1969');
  expect(row.querySelector('time')?.textContent).toContain('21:00:01');
  expect(within(row).queryByRole('button', { name: 'Save penalty' })).toBeNull();
  fireEvent.click(plusTwo);
  await screen.findByText('3.23 (+2)');
  expect(plusTwo.getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(plusTwo);
  await screen.findByText('1.23');
  expect(plusTwo.getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(dnf);
  await screen.findByText('DNF (1.23)');
  expect(dnf.getAttribute('aria-pressed')).toBe('true');
  expect(plusTwo.getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(dnf);
  await screen.findByText('1.23');
  expect((await repository.listTimedResults())[0]).toMatchObject({ penalty: 'none', rawDurationMs: 1234.567 });
});
