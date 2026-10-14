import { normalizeTurns } from './guidance';
import { FACES, isFacelets, SOLVED, turn } from './cube';

export const CROSS_COLORS = ['white', 'yellow', 'red', 'orange', 'green', 'blue'] as const;
export type CrossColor = typeof CROSS_COLORS[number];
export const COLOR_FACE: Record<CrossColor, string> = { white: 'U', yellow: 'D', red: 'R', orange: 'L', green: 'F', blue: 'B' };
export const CROSS_MOVES = [...FACES].flatMap(face => [face, `${face}'`, `${face}2`]);
export const CROSS_EDGES = [[5,10],[7,19],[3,37],[1,46],[32,16],[28,25],[30,43],[34,52],[23,12],[21,41],[50,39],[48,14]];
const CAPACITY = 24 ** 4;
const REACHABLE = 190_080;
const inverse = (move: string): string => move.endsWith('2') ? move : move.endsWith("'") ? move[0] : `${move}'`;

// Track four labeled edges, each encoded by slot*2 + orientation. Impossible
// repeated slots are holes in this small sparse address space.
let transitions: Uint8Array[] | undefined;
function getTransitions(): Uint8Array[] {
  return transitions ??= CROSS_MOVES.map(move => {
    const moved = turn(Array.from({ length: 54 }, (_, i) => String.fromCharCode(65 + i)).join(''), move);
    const map = new Uint8Array(24);
    CROSS_EDGES.forEach((indices, slot) => {
      const target = CROSS_EDGES.findIndex(pair => pair.includes(moved.indexOf(String.fromCharCode(65 + indices[0]))));
      const flipped = moved.indexOf(String.fromCharCode(65 + indices[0])) === CROSS_EDGES[target][0] ? 0 : 1;
      map[slot*2] = target*2 + flipped;
      map[slot*2+1] = target*2 + (flipped ^ 1);
    });
    return map;
  });
}
export function crossSuccessor(code: number, move: number): number {
  const map = getTransitions()[move];
  return map[code % 24] + 24 * (map[Math.floor(code / 24) % 24] + 24 * (map[Math.floor(code / 576) % 24] + 24 * map[Math.floor(code / 13824)]));
}
function selectedEdges(color: CrossColor): number[] {
  if (!CROSS_COLORS.includes(color)) throw new Error('Unknown cross color');
  return CROSS_EDGES.map((pair, i) => pair.some(index => SOLVED[index] === COLOR_FACE[color]) ? i : -1).filter(i => i >= 0);
}
export function crossCoordinate(facelets: string, color: CrossColor): number {
  let code = 0;
  selectedEdges(color).forEach((piece, i) => {
    const pair = CROSS_EDGES[piece].map(index => SOLVED[index]);
    const slot = CROSS_EDGES.findIndex(indices => indices.every(index => pair.includes(facelets[index])));
    if (slot < 0) throw new Error('Missing cross edge');
    const orientation = facelets[CROSS_EDGES[slot][0]] === pair[0] ? 0 : 1;
    code += (slot * 2 + orientation) * 24 ** i;
  });
  return code;
}
export function isCrossSolved(facelets: string, color: CrossColor): boolean {
  return selectedEdges(color).every(piece => CROSS_EDGES[piece].every(index => facelets[index] === SOLVED[index]));
}
export interface CrossCase {
  caseId: string;
  startingState: string;
  originalScramble: string;
  scrambleSource?: string;
  color: CrossColor;
  optimum: number;
}
export interface CrossQuery { distance: number; nextMoves: string[]; continuation: string[] }
/** All optimal routes, sharing nodes reached by different prefixes. */
export interface CrossGraph {
  root: number;
  nodes: Record<number, { distance: number; edges: { move: string; next: number }[] }>;
}
export interface CrossMetrics { buildMilliseconds: number; tableBytes: number; peakTypedArrayBytes: number; reachableStates: number; maximumDistance: number }

export class CrossSolver {
  private readonly distances = new Uint8Array(CAPACITY).fill(255);
  private readonly representatives: number[] = [];
  readonly metrics: CrossMetrics;
  constructor(readonly color: CrossColor) {
    const started = performance.now();
    const goal = crossCoordinate(SOLVED, color);
    const queue = new Uint32Array(REACHABLE);
    queue[0] = goal;
    this.distances[goal] = 0;
    this.representatives[0] = goal;
    let tail = 1;
    for (let head = 0; head < tail; head++) {
      const code = queue[head];
      const distance = this.distances[code] + 1;
      for (let move = 0; move < 18; move++) {
        const next = crossSuccessor(code, move);
        if (this.distances[next] !== 255) continue;
        this.distances[next] = distance;
        this.representatives[distance] ??= next;
        queue[tail++] = next;
      }
    }
    if (tail !== REACHABLE || !this.representatives[8]) throw new Error('Complete exact cross table unavailable');
    this.metrics = { buildMilliseconds: performance.now() - started, tableBytes: this.distances.byteLength, peakTypedArrayBytes: this.distances.byteLength + queue.byteLength + 18*24, reachableStates: tail, maximumDistance: this.representatives.length - 1 };
  }
  distance(facelets: string): number {
    if (!isFacelets(facelets)) throw new Error('A valid full cube state is required');
    return this.distances[crossCoordinate(facelets, this.color)];
  }
  private next(code: number): number[] {
    return CROSS_MOVES.map((_, i) => i).filter(i => this.distances[crossSuccessor(code, i)] === this.distances[code] - 1);
  }
  private continuation(code: number): string[] {
    const result: string[] = [];
    while (this.distances[code] > 0) {
      const move = this.next(code)[0];
      if (move === undefined) throw new Error('Missing exact continuation');
      result.push(CROSS_MOVES[move]);
      code = crossSuccessor(code, move);
    }
    return result;
  }
  query(facelets: string): CrossQuery {
    const distance = this.distance(facelets);
    const code = crossCoordinate(facelets, this.color);
    return { distance, nextMoves: this.next(code).map(i => CROSS_MOVES[i]), continuation: this.continuation(code) };
  }
  graph(facelets: string): CrossGraph {
    this.distance(facelets);
    const root = crossCoordinate(facelets, this.color);
    const nodes: CrossGraph['nodes'] = {};
    const visit = (code: number): void => {
      if (nodes[code]) return;
      const edges = this.next(code).map(move => ({ move: CROSS_MOVES[move], next: crossSuccessor(code, move) }));
      nodes[code] = { distance: this.distances[code], edges };
      edges.forEach(edge => visit(edge.next));
    };
    visit(root);
    return { root, nodes };
  }
  generate(difficulty: number, source = SOLVED): CrossCase {
    if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 8) throw new Error('Cross difficulty must be an integer from 1 through 8');
    if (!isFacelets(source)) throw new Error('A valid full cube state is required');
    // Mix the entire cube before installing a random exact-distance cross.
    // Keep the setup comparable to a normal scramble, never an inverse hint.
    const random = (limit: number) => crypto.getRandomValues(new Uint32Array(1))[0] % limit;
    let chosen = this.representatives[difficulty];
    let seen = 0;
    for (let code = 0; code < this.distances.length; code++) {
      if (this.distances[code] === difficulty && random(++seen) === 0) chosen = code;
    }
    const corners = [[8,9,20],[2,45,11],[0,36,47],[6,18,38],[29,26,15],[27,44,24],[33,53,42],[35,17,51]];
    const otherEdges = CROSS_EDGES.filter((_, i) => !selectedEdges(this.color).includes(i));
    for (;;) {
      const mixing: string[] = [];
      for (let i = 0; i < 12; i++) {
        const choices = CROSS_MOVES.filter(move => move[0] !== mixing.at(-1)?.[0]);
        mixing.push(choices[random(choices.length)]);
      }
      const mixed = mixing.reduce(turn, source);
      let scramble = [...mixing, ...this.continuation(crossCoordinate(mixed, this.color)), ...this.continuation(chosen).reverse().map(inverse)];
      let previous: string;
      do { previous = scramble.join(' '); scramble = normalizeTurns(scramble); } while (previous !== scramble.join(' '));
      if (scramble.length < 18 || scramble.length > 25) continue;
      const startingState = scramble.reduce(turn, source);
      if ([...corners, ...otherEdges].some(piece => piece.every(index => startingState[index] === SOLVED[index]))) continue;
      if (this.distance(startingState) !== difficulty) throw new Error('Generated difficulty verification failed');
      return { caseId: `cross-v1:${this.color}:${startingState}`, startingState, originalScramble: scramble.join(' '), scrambleSource: source, color: this.color, optimum: difficulty };
    }
  }
}
