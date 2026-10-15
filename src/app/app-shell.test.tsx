import { beforeAll } from 'vitest';
beforeAll(() => { globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }; });
// @vitest-environment jsdom
import { IDBFactory } from 'fake-indexeddb';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LiveApp } from './LiveApp';
import { LocalRepository } from '../adapters/local-repository';
afterEach(() => { cleanup(); window.location.hash = ''; });
it('lands on Solve, gates Debug and persists settings through reopening', async () => {
  const repository = new LocalRepository(new IDBFactory());
  const connectCube = vi.fn(async () => { throw new Error('unused'); });
  window.location.hash = '#/debug';
  const view = render(<LiveApp repository={repository} connectCube={connectCube} />);
  await screen.findByRole('heading', { name: 'Solve', level: 1 });
  expect(screen.queryByRole('link', { name: 'Debug' })).toBeNull();
  expect(screen.queryByText(/quaternion/i)).toBeNull();
  fireEvent.click(screen.getByRole('link', { name: 'Settings' }));
  await screen.findByRole('checkbox', { name: 'Enable Debug' });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Enable Debug' }));
  expect((await repository.load()).settings.debug).toBe(true);
  fireEvent.click(screen.getByRole('checkbox', { name: /Use inspection/ }));
  view.unmount();
  render(<LiveApp repository={repository} connectCube={connectCube} />);
  expect((await screen.findByRole('checkbox', { name: 'Enable Debug' }) as HTMLInputElement).checked).toBe(true);
  expect((screen.getByRole('checkbox', { name: /Use inspection/ }) as HTMLInputElement).checked).toBe(true);
  expect(connectCube).not.toHaveBeenCalled();
});
