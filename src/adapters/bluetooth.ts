import type { MacAddressProvider } from 'gan-web-bluetooth';
import type { Connection } from '../domain/session';

const coordinators = new WeakMap<BluetoothDevice, () => Promise<unknown>>();
/** Coordinate the selected device's native operations, including library-internal writes.
 * Scoped instance wrappers preserve native receivers; no browser prototypes are changed.
 */
export function coordinateGatt(device: BluetoothDevice): void {
  if (!device.gatt || coordinators.has(device)) return;
  let tail: Promise<unknown> = Promise.resolve();
  const wrapped = new WeakSet<object>();
  const server = device.gatt;
  const reconnect = server.connect?.bind(server);
  function enqueue(operation: () => Promise<unknown>): Promise<unknown> {
    const result = tail.then(operation);
    tail = result.catch(() => {});
    return result;
  }
  function decorate(target: object, methods: string[], discover = false): void {
    if (wrapped.has(target)) return;
    wrapped.add(target);
    const object = target as Record<string, unknown>;
    for (const name of methods) {
      const original = object[name];
      if (typeof original !== 'function') continue;
      object[name] = (...args: unknown[]) => enqueue(async () => {
        for (let attempt = 0; ; attempt++) {
          try {
            const result: unknown = await original.apply(target, args);
            if (discover) for (const child of Array.isArray(result) ? result : [result]) {
              if (!child || typeof child !== 'object') continue;
              if (name.startsWith('getPrimaryService')) decorate(child, ['getCharacteristic', 'getCharacteristics'], true);
              else decorate(child, ['readValue', 'writeValue', 'writeValueWithResponse', 'writeValueWithoutResponse', 'startNotifications', 'stopNotifications']);
            }
            return result;
          } catch (error) {
            if (attempt >= 2 || !(error instanceof DOMException) || error.name !== 'NetworkError') throw error;
            if (discover && !server.connected && reconnect) await reconnect();
            else if (!/operation already in progress/i.test(error.message)) throw error;
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      });
    }
  }
  decorate(server, ['connect', 'getPrimaryService', 'getPrimaryServices'], true);
  const disconnect = server.disconnect.bind(server);
  server.disconnect = () => { void enqueue(async () => { disconnect(); }); };
  coordinators.set(device, () => tail);
}

/** Release the selected device even when setup fails before a connection is returned. */
export async function connectCube(provider: MacAddressProvider, open: (provider?: MacAddressProvider) => Promise<Connection>): Promise<Connection> {
  let selected: BluetoothDevice | null = null;
  try {
    return await open(async (device, fallback) => {
      selected = device;
      coordinateGatt(device);
      return provider(device, fallback);
    });
  } catch (error) {
    // The library does not clean up failed service discovery / notification setup.
    const device = selected as BluetoothDevice | null;
    try { device?.gatt?.disconnect(); } catch { /* Preserve the original setup failure. */ }
    if (device) await coordinators.get(device)?.();
    if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'NetworkError' && 'message' in error) {
      throw new Error(`${error.message} Click Connect cube to retry; no page refresh is needed. Keep the cube awake and disconnect it from other apps.`, { cause: error });
    }
    throw error;
  }
}

export function createMacProvider(storage: Pick<Storage, 'getItem' | 'setItem'>, prompt: (message: string) => string | null) {
  return async (device: { id: string }, fallback?: boolean): Promise<string | null> => {
    const key = `cube-trainer.mac.${device.id}`;
    let saved: string | null = null;
    try { saved = storage.getItem(key); } catch { /* Storage may be disabled. */ }
    if (saved && /^[\dA-F]{2}(:[\dA-F]{2}){5}$/i.test(saved)) return saved;
    if (!fallback) return null;
    const entered = prompt('Enter the cube Bluetooth MAC address (from the GAN app / device label). It will be remembered for this device. Cancel to stop.');
    if (entered === null) return null;
    const compact = entered.replace(/[:\s-]/g, '').toUpperCase();
    if (!/^[\dA-F]{12}$/.test(compact)) throw new Error('Invalid Bluetooth MAC address: enter six hexadecimal pairs.');
    const mac = compact.match(/.{2}/g)!.join(':');
    try { storage.setItem(key, mac); } catch { /* Connection can continue without persistence. */ }
    return mac;
  };
}
