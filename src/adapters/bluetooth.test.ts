// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { connectCube, createMacProvider, coordinateGatt } from './bluetooth';
import type { MacAddressProvider } from 'gan-web-bluetooth';
it('recovers disconnected service discovery on the same selected device', async () => {
  const service = { getCharacteristic: vi.fn() };
  let attempts = 0;
  const reconnect = vi.fn(async () => server);
  const server = { connected: true, connect: reconnect, disconnect: vi.fn(), getPrimaryServices: vi.fn(async () => {
    if (++attempts === 1) { server.connected = false; throw new DOMException('GATT Server is disconnected. Cannot retrieve services.', 'NetworkError'); }
    return [service];
  }) };
  const device = { gatt: server } as unknown as BluetoothDevice;
  coordinateGatt(device);
  expect(await device.gatt!.getPrimaryServices()).toEqual([service]);
  expect(reconnect).toHaveBeenCalledOnce();
});
it('serializes protocol history writes, app writes, notification setup and teardown together', async () => {
  let finish: () => void = () => {};
  const calls: string[] = [];
  const characteristic = { writeValue: vi.fn(async () => { calls.push('write'); if (calls.length === 1) await new Promise<void>(resolve => { finish = resolve; }); }), startNotifications: vi.fn(async () => { calls.push('start'); return characteristic; }), stopNotifications: vi.fn(async () => { calls.push('stop'); return characteristic; }) };
  const service = { getCharacteristic: async () => characteristic };
  const server = { getPrimaryServices: async () => [service], disconnect: () => { calls.push('disconnect'); } };
  const device = { gatt: server } as unknown as BluetoothDevice;
  coordinateGatt(device);
  const [wrappedService] = await device.gatt!.getPrimaryServices();
  const wrapped = await wrappedService.getCharacteristic('command');
  const history = wrapped.writeValue(new Uint8Array([1]));
  await Promise.resolve(); await Promise.resolve();
  const app = wrapped.writeValue(new Uint8Array([2]));
  const setup = wrapped.startNotifications();
  const teardown = wrapped.stopNotifications();
  device.gatt!.disconnect();
  expect(calls).toEqual(['write']);
  finish(); await Promise.all([history, app, setup, teardown]);
  await Promise.resolve(); await Promise.resolve();
  expect(calls).toEqual(['write', 'write', 'start', 'stop', 'disconnect']);
});
it('bounds busy-operation retries and lets subsequent queued operations proceed after failure', async () => {
  vi.useFakeTimers();
  try {
    const busy = new DOMException('GATT operation already in progress', 'NetworkError');
    const write = vi.fn(async () => { throw busy; });
    const read = vi.fn(async () => new DataView(new ArrayBuffer(1)));
    const characteristic = { writeValue: write, readValue: read };
    const service = { getCharacteristic: async () => characteristic };
    const device = { gatt: { connected: true, getPrimaryServices: async () => [service], disconnect: vi.fn() } } as unknown as BluetoothDevice;
    coordinateGatt(device); coordinateGatt(device);
    const [wrappedService] = await device.gatt!.getPrimaryServices();
    const wrapped = await wrappedService.getCharacteristic('command');
    const rejected = expect(wrapped.writeValue(new Uint8Array([1]))).rejects.toBe(busy);
    const next = wrapped.readValue();
    await vi.advanceTimersByTimeAsync(200);
    await rejected;
    expect(write).toHaveBeenCalledTimes(3);
    expect(await next).toBeInstanceOf(DataView);
    expect(read).toHaveBeenCalledOnce();
  } finally { vi.useRealTimers(); }
});
it('releases a failed GATT setup and allows the next Connect click without a page reload', async () => {
  const disconnect = vi.fn();
  const device = { id: 'cube', gatt: { disconnect } } as unknown as BluetoothDevice;
  const connection = { deviceName: 'GAN', events$: { subscribe: vi.fn() }, sendCubeCommand: vi.fn(), disconnect: vi.fn(async () => {}) };
  const open = vi.fn(async (provider?: MacAddressProvider) => {
    await provider!(device, false);
    if (open.mock.calls.length === 1) throw new DOMException('GATT Server is disconnected. Cannot retrieve services.', 'NetworkError');
    return connection;
  });
  await expect(connectCube(async () => 'AA:BB:CC:DD:EE:FF', open)).rejects.toThrow('Click Connect cube to retry');
  expect(disconnect).toHaveBeenCalledOnce();
  const result = await connectCube(async () => 'AA:BB:CC:DD:EE:FF', open);
  expect(result.deviceName).toBe('GAN');
  expect(open).toHaveBeenCalledTimes(2);
});
it('allows automatic discovery first and remembers a valid fallback MAC per device', async () => {
  const storage = new Map<string, string>();
  const store = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); } };
  const prompt = vi.fn(() => 'aa-bb-cc-dd-ee-ff');
  const provider = createMacProvider(store, prompt);
  expect(await provider({ id: 'one' }, false)).toBe(null);
  expect(await provider({ id: 'one' }, true)).toBe('AA:BB:CC:DD:EE:FF');
  expect(await createMacProvider(store, prompt)({ id: 'one' }, false)).toBe('AA:BB:CC:DD:EE:FF');
  expect(await provider({ id: 'two' }, false)).toBe(null);
  expect(prompt).toHaveBeenCalledOnce();
});
it('does not save cancelled or malformed input and works when storage is disabled', async () => {
  const store = { getItem: vi.fn(() => null), setItem: vi.fn() };
  expect(await createMacProvider(store, () => null)({ id: 'one' }, true)).toBe(null);
  await expect(createMacProvider(store, () => 'invalid')({ id: 'one' }, true)).rejects.toThrow('Invalid Bluetooth MAC');
  expect(store.setItem).not.toHaveBeenCalled();
  const disabled = { getItem: () => { throw new Error('disabled'); }, setItem: () => { throw new Error('disabled'); } };
  expect(await createMacProvider(disabled, () => 'AA:BB:CC:DD:EE:FF')({ id: 'one' }, true)).toBe('AA:BB:CC:DD:EE:FF');
});
