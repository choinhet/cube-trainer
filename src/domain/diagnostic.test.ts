import { describe, expect, it } from 'vitest';
import { Diagnostic } from './diagnostic';
import type { GanCubeEvent } from 'gan-web-bluetooth';

const solved = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
const state = { CP: [0,1,2,3,4,5,6,7], CO: Array<number>(8).fill(0), EP: [0,1,2,3,4,5,6,7,8,9,10,11], EO: Array<number>(12).fill(0) };
function facelets(serial = 10, value = solved): GanCubeEvent {
  return { type: 'FACELETS', timestamp: 1000, serial, facelets: value, state };
}
function move(serial = 11, notation = 'U', localTimestamp: number | null = 1001): GanCubeEvent {
  return { type: 'MOVE', timestamp: 1001, serial, face: 'URFDLB'.indexOf(notation[0]), direction: notation.endsWith("'") ? 1 : 0, move: notation, localTimestamp, cubeTimestamp: 10 };
}

describe('diagnostic event adapter', () => {
  it('requires explicit synchronization, preserves physical turns and uses host monotonic receipt time', () => {
    const diagnostic = new Diagnostic();
    diagnostic.receive(facelets(), 1);
    expect(diagnostic.snapshot().tracking).toBe('unvalidated');
    diagnostic.confirmState();
    diagnostic.receive(move(), 8);
    expect(diagnostic.snapshot().tracking).toBe('tracking');
    expect(diagnostic.snapshot().facelets).toBe('UUUUUUUUUBBBRRRRRRRRRFFFFFFDDDDDDDDDFFFLLLLLLLLLBBBBBB');
    expect(diagnostic.snapshot().turns).toEqual([{ move: 'U', serial: 11, hostMs: 8, deviceMs: 10 }]);
    expect(diagnostic.trace()[1].receivedHostMs).toBe(8);
  });
  it.each([
    ['duplicate', move(11)],
    ['out of order', move(10)],
    ['gap', move(13)],
    ['recovered move', move(12, 'R', null)],
    ['invalid face mapping', { ...move(12), face: 1 }],
    ['state mismatch', facelets(11)],
    ['state serial mismatch', facelets(15)],
    ['disconnect', { type: 'DISCONNECT', timestamp: 1002 }],
  ] as [string, GanCubeEvent][])('invalidates tracking on %s and retains the offending raw event', (_, event) => {
    const diagnostic = new Diagnostic();
    diagnostic.receive(facelets(), 1);
    diagnostic.confirmState();
    diagnostic.receive(move(), 8);
    diagnostic.receive(event, 9);
    expect(diagnostic.snapshot().tracking).toBe('invalid');
    expect(diagnostic.snapshot().reason).toBeTruthy();
    expect(diagnostic.snapshot().turns).toHaveLength(1);
    expect(diagnostic.trace().at(-1)?.event).toEqual(event);
    diagnostic.receive(move(12, 'R'), 10);
    expect(diagnostic.snapshot().turns).toHaveLength(1);
  });
  it('keeps gyro orientation separate from logical state and records observed capabilities without asserting support', () => {
    const diagnostic = new Diagnostic();
    diagnostic.receive(facelets(255), 1);
    diagnostic.confirmState();
    diagnostic.receive({ type: 'GYRO', timestamp: 1000, quaternion: { x: 0, y: 0, z: 0, w: 1 } }, 2);
    expect(diagnostic.snapshot().orientation).toEqual({ x: 0, y: 0, z: 0, w: 1 });
    expect(diagnostic.snapshot().facelets).toBe(solved);
    expect(diagnostic.snapshot().observed).toEqual({ state: true, gyro: true, moves: false });
    diagnostic.receive(move(0), 3);
    expect(diagnostic.snapshot().tracking).toBe('tracking');
    expect(diagnostic.snapshot().observed.moves).toBe(true);
  });
  it('requires fresh state after movement and does not clear invalid tracking on an unsolicited report', () => {
    const diagnostic = new Diagnostic();
    diagnostic.receive(facelets(), 1);
    diagnostic.receive(move(), 2);
    expect(() => diagnostic.confirmState()).toThrow('fresh state');
    diagnostic.receive(facelets(11), 3);
    diagnostic.confirmState();
    diagnostic.receive(move(13), 4);
    diagnostic.receive(facelets(13), 5);
    expect(diagnostic.snapshot().tracking).toBe('invalid');
    diagnostic.confirmState();
    expect(diagnostic.snapshot().tracking).toBe('tracking');
  });
  it('does not allow a stale confirmation after a malformed state report', () => {
    const diagnostic = new Diagnostic();
    diagnostic.receive(facelets(), 1);
    diagnostic.receive(facelets(10, 'not a cube state'), 2);
    expect(diagnostic.snapshot().tracking).toBe('invalid');
    expect(() => diagnostic.confirmState()).toThrow('fresh state');
  });
});
