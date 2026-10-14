// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { GuidanceSteps } from './GuidanceSteps';
afterEach(cleanup);
it('shows all correction moves, then resumes the preserved full setup', () => {
  const sequence = Array.from({ length: 60 }, (_, i) => `move-${i}`);
  const undo = Array.from({ length: 28 }, (_, i) => `undo-${i}`);
  const guide = { sequence, undo, remaining: sequence.slice(2), progress: 2, provisional: false };
  const view = render(<GuidanceSteps guide={guide} status="correction" />);
  expect(within(screen.getByLabelText('Undo moves')).getAllByRole('listitem')).toHaveLength(28);
  expect(screen.getByText('undo-27')).toBeTruthy();
  expect(screen.queryByLabelText('Actual setup moves')).toBeNull();
  view.rerender(<GuidanceSteps guide={{ ...guide, undo: [] }} status="preparing" />);
  const moves = within(screen.getByLabelText('Actual setup moves')).getAllByRole('listitem');
  expect(moves).toHaveLength(60);
  expect(moves[0].getAttribute('data-completed')).toBe('true');
  expect(moves[2].getAttribute('aria-current')).toBe('step');
  expect(screen.getByText('move-59')).toBeTruthy();
});
