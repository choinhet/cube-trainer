// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { IconButton } from './IconButton';
afterEach(cleanup);
it('provides one accessible action without a duplicate native tooltip and activates on one click', () => {
  const activate = vi.fn();
  render(<IconButton label="Copy scramble" title="Copy original scramble" onClick={activate}>Copy</IconButton>);
  const action = screen.getByRole('button', { name: 'Copy scramble' });
  expect(action.getAttribute('title')).toBeNull();
  fireEvent.click(action);
  expect(activate).toHaveBeenCalledTimes(1);
});
