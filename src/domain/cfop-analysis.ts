import { FACES, isFacelets, normals, SOLVED, stickers, turn } from './cube';
import { COLOR_FACE, CROSS_COLORS, isCrossSolved, type CrossColor } from './cross';
import type { TimedResult } from './timed-attempt';

export interface CFOPPhase {
  phase: 'Cross' | 'F2L' | 'OLL' | 'PLL';
  startMs: number;
  endMs: number;
  durationMs: number;
  startIndex: number;
  endIndex: number;
}
export interface CFOPAnalysis {
  version: 1;
  crossColor: CrossColor;
  phases: CFOPPhase[];
  states: string[];
  moveTimesMs: number[];
}
const inverse = (move: string) => move.endsWith('2') ? move : move.endsWith("'") ? move[0] : `${move}'`;
/** Full-cube milestones for the selected cross axis, independent of algorithm notation. */
export function cfopProgress(state: string, color: CrossColor) {
  const face = FACES.indexOf(COLOR_FACE[color]);
  const axis = normals[face];
  const projection = (position: number[]) => position.reduce((sum, value, i) => sum + value * axis[i], 0);
  const f2l = stickers.every((sticker, i) => projection(sticker.position) === -1 || state[i] === SOLVED[i]);
  const opposite = normals.findIndex(normal => normal.every((value, i) => value === -axis[i]));
  const oll = f2l && Array.from({ length: 9 }, (_, i) => opposite * 9 + i).every(i => state[i] === SOLVED[i]);
  const corners = stickers.filter(sticker => projection(sticker.position) === 1 && sticker.position.filter(value => value !== 0).length === 3).map(sticker => sticker.position).filter((position, i, all) => all.findIndex(other => other.every((value, j) => value === position[j])) === i);
  const pairs = corners.map(position => stickers.every((sticker, i) => {
    const matchesCorner = sticker.position.every((value, j) => value === position[j]);
    const matchesEdge = sticker.position.every((value, j) => value === position[j] - axis[j]);
    return (!matchesCorner && !matchesEdge) || state[i] === SOLVED[i];
  }));
  return { cross: isCrossSolved(state, color), f2l, oll, pairs };
}
/** Replay uses the stored final state and physical moves; penalties never enter the clock. */
export function analyzeCFOP(result: TimedResult): CFOPAnalysis | null {
  const moves = result.rawTurns;
  if (result.status !== 'completed' || result.facelets !== SOLVED || !moves?.length || !Number.isFinite(result.rawDurationMs) || result.rawDurationMs < 0) return null;
  if (moves.some((move, i) => !/^[URFDLB](2|')?$/.test(move.move) || !Number.isInteger(move.serial) || move.serial < 0 || move.serial > 255 || !Number.isFinite(move.hostMs) || (i > 0 && (move.serial !== (moves[i - 1].serial + 1) % 256 || move.hostMs < moves[i - 1].hostMs)))) return null;
  const moveTimesMs = moves.map(move => move.hostMs - moves[0].hostMs);
  if (moveTimesMs.at(-1)! > result.rawDurationMs) return null;
  const states = Array<string>(moves.length + 1);
  states[moves.length] = result.facelets;
  for (let i = moves.length - 1; i >= 0; i--) states[i] = turn(states[i + 1], inverse(moves[i].move));
  if (!isFacelets(states[0]) || states[0] === SOLVED) return null;
  const candidates = CROSS_COLORS.map(color => {
    const progress = states.map(state => cfopProgress(state, color));
    // Face turns disrupt solved pieces inside a case. Compare restored Cross
    // checkpoints so an ordinary R U R' insertion does not erase phase progress.
    const checkpoints = progress.flatMap((value, index) => value.cross ? [index] : []);
    const cross = checkpoints.find(index => checkpoints.filter(next => next >= index).every(next => progress[index].pairs.every((solved, pair) => !solved || progress[next].pairs[pair]))) ?? moves.length;
    const f2l = progress.findIndex((value, index) => index >= cross && value.f2l);
    const oll = progress.findIndex((value, index) => index >= f2l && value.oll);
    return { color, cross, f2l, oll };
  }).filter(candidate => candidate.cross <= candidate.f2l && candidate.f2l <= candidate.oll && candidate.f2l < moves.length && (candidate.cross === 0 || candidate.cross < candidate.f2l));
  candidates.sort((a, b) => a.cross - b.cross || a.f2l - b.f2l);
  const selected = candidates[0];
  if (!selected) return null;
  const boundaries = [0, selected.cross, selected.f2l, selected.oll, moves.length];
  const time = (index: number) => index === 0 ? 0 : index === moves.length ? result.rawDurationMs : moveTimesMs[index - 1];
  const phases = (['Cross', 'F2L', 'OLL', 'PLL'] as const).map((phase, i) => ({ phase, startIndex: boundaries[i], endIndex: boundaries[i + 1], startMs: time(boundaries[i]), endMs: time(boundaries[i + 1]), durationMs: time(boundaries[i + 1]) - time(boundaries[i]) }));
  return { version: 1, crossColor: selected.color, phases, states, moveTimesMs };
}
