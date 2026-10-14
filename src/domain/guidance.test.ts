import { expect, it } from 'vitest';
import { Guidance, normalizeTurns } from './guidance';
import { SOLVED, turn } from './cube';
import type { PhysicalTurn } from './diagnostic';

function event(move: string, hostMs = 0): PhysicalTurn { return { move, hostMs, serial: 1, deviceMs: null }; }

it('normalizes maximal same-face runs without merging across other faces', () => {
  expect(normalizeTurns(['R', 'R'])).toEqual(['R2']);
  expect(normalizeTurns(['R', "R'"])).toEqual([]);
  expect(normalizeTurns(['R', 'R', 'R'])).toEqual(["R'"]);
  expect(normalizeTurns(["R'", "R'"])).toEqual(['R2']);
  expect(normalizeTurns(['R', 'U', "U'", 'R'])).toEqual(['R', 'R']);
});

it.each(['R', "R'"])('keeps paused %s quarters provisional and completes the exact half-turn target', move => {
  const guide = new Guidance(SOLVED, ['R2']);
  guide.receive(event(move));
  expect(guide.snapshot()).toMatchObject({ status: 'preparing', provisional: true, progress: 0, facelets: turn(SOLVED, move), undo: [] });
  guide.receive(event(move, 600_000));
  expect(guide.snapshot()).toMatchObject({ status: 'ready', progress: 1, facelets: turn(SOLVED, 'R2'), provisional: false });
  expect(guide.snapshot().raw).toHaveLength(2);
});

it('commits a valid open run when the next face begins and resolves the final run', () => {
  const guide = new Guidance(SOLVED, ['R', 'U2']);
  guide.receive(event('R'));
  expect(guide.snapshot().progress).toBe(1);
  guide.receive(event('U'));
  expect(guide.snapshot()).toMatchObject({ progress: 1, status: 'preparing', provisional: true });
  guide.receive(event('U', 100_000));
  expect(guide.snapshot()).toMatchObject({ progress: 2, status: 'ready' });
});

it('resolves an incomplete prior half turn into correction when another face begins', () => {
  const guide = new Guidance(SOLVED, ['R2', 'U']);
  guide.receive(event('R'));
  guide.receive(event('U'));
  expect(guide.snapshot()).toMatchObject({ status: 'correction', progress: 0, undo: ["U'", "R'"], remaining: ['R2', 'U'] });
});

it('extends nested correction and restores the exact anchor before resuming R', () => {
  const guide = new Guidance(SOLVED, ['R', 'D']);
  for (const move of ['U', 'F']) guide.receive(event(move));
  expect(guide.snapshot()).toMatchObject({ undo: ["F'", "U'"], remaining: ['R', 'D'] });
  guide.receive(event('L'));
  expect(guide.snapshot().undo).toEqual(["L'", "F'", "U'"]);
  for (const move of ["L'", "F'", 'U']) guide.receive(event(move));
  expect(guide.snapshot()).toMatchObject({ status: 'correction', undo: ['U2'], progress: 0 });
  guide.receive(event('U'));
  expect(guide.snapshot()).toMatchObject({ status: 'correction', undo: ['U'] });
  guide.receive(event('U'));
  expect(guide.snapshot()).toMatchObject({ status: 'preparing', facelets: SOLVED, progress: 0 });
  for (const move of ['R', 'D']) guide.receive(event(move));
  expect(guide.snapshot()).toMatchObject({ status: 'ready', progress: 2, facelets: turn(turn(SOLVED, 'R'), 'D') });
  expect(guide.snapshot().raw).toHaveLength(10);
});

it('reevaluates overshoots and identity against the prefix before the open run', () => {
  const guide = new Guidance(SOLVED, ["R'", 'F']);
  for (const move of ['R', "R'", 'R', 'R', 'R']) guide.receive(event(move));
  expect(guide.snapshot()).toMatchObject({ status: 'preparing', progress: 1, undo: [] });
  guide.receive(event('F'));
  expect(guide.snapshot()).toMatchObject({ status: 'ready', progress: 2 });
});

it('does not count a cancelled run as intended progress', () => {
  const guide = new Guidance(SOLVED, ['R2', 'U']);
  for (const move of ['R', "R'", 'U']) guide.receive(event(move));
  expect(guide.snapshot()).toMatchObject({ status: 'correction', progress: 0, undo: ["U'"] });
});
