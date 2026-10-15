// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SolveScramble } from './SolveScramble';
import { requestExerciseSetup } from '../../workers/setup-client';
import { SOLVED, turn } from '../../domain/cube';
import { inverse } from '../../domain/guidance';
import type { TimedResult } from '../../domain/timed-attempt';
vi.mock('../../workers/setup-client', () => ({ requestExerciseSetup: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const base: TimedResult = { id: 's', sessionId: 's', status: 'completed', startedAt: 0, rawDurationMs: 1000, penalty: 'none', timingBasis: 'host-monotonic-receipt' };
it('shows and copies the stored original scramble without reconstructing physical solve turns', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  render(<SolveScramble result={{ ...base, originalScramble: 'R2 U F2' }} />);
  expect(screen.getByRole('group', { name: 'Original scramble' })).toBeTruthy();
  expect(screen.getByText('R2 U F2')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Copy scramble' }));
  await screen.findByText('Scramble copied');
  expect(writeText).toHaveBeenCalledWith('R2 U F2');
  expect(requestExerciseSetup).not.toHaveBeenCalled();
});
it('shortens a long legacy reconstruction and copies the displayed equivalent scramble', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  const moves = [...Array.from({ length: 12 }, () => ['R', 'U', "R'", "U'"]).flat(), 'F'];
  vi.mocked(requestExerciseSetup).mockResolvedValue({ source: SOLVED, target: turn(SOLVED, 'F'), moves: ['F'] });
  const rawTurns = moves.slice().reverse().map(inverse).map((move, serial) => ({ move, serial, hostMs: serial * 100, deviceMs: null }));
  render(<SolveScramble result={{ ...base, facelets: SOLVED, rawTurns }} />);
  expect(screen.getByRole('group', { name: 'Equivalent scramble' })).toBeTruthy();
  await screen.findByText('F');
  expect(requestExerciseSetup).toHaveBeenCalledWith(SOLVED, expect.objectContaining({ target: turn(SOLVED, 'F'), minimumSetupMoves: 1 }), expect.any(AbortSignal));
  fireEvent.click(screen.getByRole('button', { name: 'Copy scramble' }));
  await screen.findByText('Scramble copied');
  expect(writeText).toHaveBeenCalledWith('F');
});

