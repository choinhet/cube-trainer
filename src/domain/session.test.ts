import { expect, it, vi } from 'vitest';
import { DiagnosticSession, type Connection } from './session';
import type { GanCubeEvent } from 'gan-web-bluetooth';

it('allows retry after chooser cancellation and records events and disconnects once', async () => {
  let deliver: (event: GanCubeEvent) => void = () => {};
  const unsubscribe = vi.fn();
  const connection: Connection = {
    deviceName: 'test cube',
    events$: { subscribe: observer => { deliver = observer.next; return { unsubscribe }; } },
    sendCubeCommand: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
  };
  const chooser = vi.fn<() => Promise<Connection>>()
    .mockRejectedValueOnce(new DOMException('Cancelled', 'NotFoundError'))
    .mockResolvedValue(connection);
  const session = new DiagnosticSession(chooser, () => 42, () => {});
  await session.connect();
  expect(session.status).toBe('disconnected');
  expect(session.error).toContain('Cancelled');
  await session.connect();
  expect(session.status).toBe('connected');
  expect(session.error).toBe(null);
  deliver({ type: 'GYRO', timestamp: 1, quaternion: { x: 0, y: 0, z: 0, w: 1 } });
  expect(session.diagnostic.trace()[0].receivedHostMs).toBe(42);
  await session.disconnect();
  expect(unsubscribe).toHaveBeenCalledOnce();
  expect(session.status).toBe('disconnected');
  expect(session.diagnostic.snapshot().tracking).toBe('invalid');
});

it('retains previous runs when reconnecting for comparison and trace capture', async () => {
  const connection: Connection = {
    deviceName: 'test cube',
    events$: { subscribe: () => ({ unsubscribe: () => {} }) },
    sendCubeCommand: async () => {}, disconnect: async () => {},
  };
  const session = new DiagnosticSession(async () => connection, () => 42, () => {});
  await session.connect();
  await session.disconnect();
  await session.connect();
  expect(session.previousRuns).toHaveLength(1);
  expect(session.previousRuns[0].at(-1)?.event.type).toBe('DISCONNECT');
});
it('releases a connection after command failure and enables a fresh Connect attempt', async () => {
  const disconnect = vi.fn(async () => {});
  const connection: Connection = {
    deviceName: 'GAN', events$: { subscribe: () => ({ unsubscribe: vi.fn() }) },
    sendCubeCommand: async () => { throw new DOMException('GATT Server is disconnected', 'NetworkError'); }, disconnect,
  };
  const session = new DiagnosticSession(async () => connection, () => 42, () => {});
  await session.connect(); await session.request('REQUEST_FACELETS');
  expect(session.status).toBe('disconnected');
  expect(disconnect).toHaveBeenCalledOnce();
  expect(session.canConnect).toBe(true);
});
it('ignores a failed command from an old connection after reconnecting', async () => {
  let reject: (error: unknown) => void = () => {};
  const old: Connection = { deviceName: 'old', events$: { subscribe: () => ({ unsubscribe: vi.fn() }) }, sendCubeCommand: () => new Promise<void>((_, fail) => { reject = fail; }), disconnect: async () => {} };
  const fresh: Connection = { ...old, deviceName: 'fresh', sendCubeCommand: async () => {} };
  const chooser = vi.fn<() => Promise<Connection>>().mockResolvedValueOnce(old).mockResolvedValue(fresh);
  const session = new DiagnosticSession(chooser, () => 42, () => {});
  await session.connect(); const pending = session.request('REQUEST_FACELETS');
  await session.disconnect(); await session.connect();
  reject(new Error('old GATT failure')); await pending;
  expect(session.status).toBe('connected');
  expect(session.deviceName).toBe('fresh');
  expect(session.error).toBe(null);
});
