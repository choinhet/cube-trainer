// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Overlay } from './Overlay';
vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
 afterEach(cleanup);
it('keeps the dialog title and close action outside overflowing content and exposes explicit size', () => {
  const change = vi.fn();
  render(<Overlay open onOpenChange={change} title="Preferences" size="wide"><button>Save</button></Overlay>);
  const dialog = screen.getByRole('dialog', { name: 'Preferences' });
  expect(dialog.getAttribute('data-size')).toBe('wide');
  expect(screen.getByRole('heading', { name: 'Preferences' }).closest('header')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Close Preferences' }));
  expect(change).toHaveBeenCalledWith(false);
});

