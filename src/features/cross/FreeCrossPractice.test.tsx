// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { CrossHistory, FreeCrossPractice } from './FreeCrossPractice';
import { CrossRepository } from '../../adapters/cross-repository';
import { LocalRepository } from '../../adapters/local-repository';
import { CrossAttempt } from '../../domain/cross-attempt';
import { SOLVED, turn } from '../../domain/cube';
import type { CrossPracticeController } from '../../domain/cross-practice';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function controller(): CrossPracticeController { return { cross: null, canPractice: true, activity: 'idle', preparation: null, startCrossPreparation: vi.fn(async () => {}), cancelCrossPractice: vi.fn(), replaceCrossPreparation: vi.fn(async () => {}), switchCrossMode: vi.fn(async () => {}), revealCrossSolution: vi.fn(async () => {}), retryCrossSave: vi.fn(), checkpointCross: vi.fn(), requireResynchronization: vi.fn() }; }

test('restoration failures are visible and retry recovery requires resynchronization', async () => {
  vi.spyOn(CrossRepository.prototype, 'recoverInterruptedAttempts').mockRejectedValueOnce(new Error('blocked')).mockResolvedValueOnce(1);
  vi.spyOn(CrossRepository.prototype, 'list').mockResolvedValue([]);
  const session = controller(); const repository = new LocalRepository(new IDBFactory());
  render(<FreeCrossPractice session={session} repository={repository} sessionReady />);
  expect((await screen.findByRole('alert')).textContent).toContain('blocked');
  expect(session.startCrossPreparation).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Retry cross history restoration' }));
  await waitFor(() => expect(session.requireResynchronization).toHaveBeenCalledOnce());
  expect(screen.queryByText(/Optimal solution from original starting state/)).toBeNull();
});

test('separate history renders full case, physical identity activity and assistance', () => {
  const attempt = new CrossAttempt('attempt', 'session', { caseId: 'r2', startingState: turn(SOLVED, 'R2'), originalScramble: 'R2', color: 'white', optimum: 1 });
  attempt.arm(); attempt.reveal();
  attempt.receive({ move: 'D', serial: 1, hostMs: 10, deviceMs: null }, 1000);
  attempt.receive({ move: "D'", serial: 2, hostMs: 20, deviceMs: null }, 2000);
  render(<CrossHistory records={[attempt.abandon(30)!]} error={null} />);
  expect(screen.getByText(/abandoned · free · white · 2 moves/)).toBeTruthy();
  expect(screen.getByText(/assisted \(solution revealed\)/)).toBeTruthy();
  expect(screen.getByText(/D D'/)).toBeTruthy();
  expect(screen.getByText(attempt.caseData.startingState)).toBeTruthy();
});

test('defaults to semi-guided six-move practice with focused move counts', () => {
  render(<FreeCrossPractice session={controller()} repository={new LocalRepository(new IDBFactory())} sessionReady={false} />);
  expect((screen.getByRole('combobox', { name: 'Mode' }) as HTMLSelectElement).value).toBe('semi-guided');
  expect((screen.getByRole('slider', { name: 'Difficulty' }) as HTMLInputElement).value).toBe('6');
  expect(screen.queryByLabelText('Cross time')).toBeNull();
  expect(screen.getByLabelText('Cross moves').textContent).toContain('6 optimal moves');
});

test('guided history hides legacy times and TPS', () => {
  const attempt = new CrossAttempt('old', 'session', { caseId: 'r2', startingState: turn(SOLVED, 'R2'), originalScramble: 'R2', color: 'white', optimum: 1 });
  attempt.arm();
  attempt.receive({ move: 'R', serial: 1, hostMs: 10, deviceMs: null }, 1000);
  const record = attempt.receive({ move: 'R', serial: 2, hostMs: 2010, deviceMs: null }, 3000)!;
  render(<CrossHistory records={[{ ...record, mode: 'semi-guided' }]} error={null} compact />);
  expect(screen.getAllByRole('cell', { name: '—' })).toHaveLength(2);
});

