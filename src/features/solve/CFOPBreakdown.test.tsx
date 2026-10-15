// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { CFOPBreakdown } from './CFOPBreakdown';
import { SOLVED } from '../../domain/cube';
afterEach(cleanup);
it('keeps explicitly opened phase details available after pointer leave and dismisses on Escape', () => {
  render(<CFOPBreakdown result={{ id: 's', sessionId: 's', status: 'completed', penalty: 'none', startedAt: 0, rawDurationMs: 1200, timingBasis: 'host-monotonic-receipt', facelets: SOLVED, rawTurns: ['U', 'U'].map((move, serial) => ({ move, serial, hostMs: serial * 1200, deviceMs: null })) }} />);
  const phase = screen.getByRole('button', { name: /execution: 1.20 seconds/ });
  fireEvent.click(phase);
  fireEvent.mouseLeave(screen.getByLabelText('Phase timing bar'));
  const details = screen.getByRole('region', { name: 'Phase details' });
  expect(phase.getAttribute('aria-pressed')).toBe('true');
  fireEvent.keyDown(details, { key: 'Escape' });
  expect(screen.queryByRole('region', { name: 'Phase details' })).toBeNull();
  expect(phase.getAttribute('aria-pressed')).toBe('false');
});
