// @vitest-environment node
import { expect, test } from 'vitest';
import { puzzles } from 'cubing/puzzles';
import { KPattern } from 'cubing/kpuzzle';
import { COLOR_FACE, CROSS_COLORS, CROSS_MOVES, CrossSolver, crossCoordinate } from './cross';
import { patternFromFacelets } from './setup-solver';
import { SOLVED, turn } from './cube';

// Independent exhaustive BFS: cubing's cubie move transformations and edge orbit
// order, rather than the production solver's sticker-derived transition maps.
test('independent cubing search verifies every color/difficulty and all compatible branches', async () => {
  const puzzle = await puzzles['3x3x3'].kpuzzle();
  const slots = [[7,19],[5,10],[1,46],[3,37],[28,25],[32,16],[34,52],[30,43],[23,12],[21,41],[48,14],[50,39]];
  const maps = CROSS_MOVES.map(move => {
    const edges = puzzle.defaultPattern().applyMove(move).patternData.EDGES;
    return Array.from({ length: 24 }, (_, value) => {
      const destination = edges.pieces.indexOf(Math.floor(value / 2));
      return destination * 2 + (edges.orientation[destination] ^ (value % 2));
    });
  });
  function step(key: number, map: number[]): number {
    let next = 0;
    for (let i = 0; i < 4; i++) { next += map[key % 24] * 24 ** i; key = Math.floor(key / 24); }
    return next;
  }
  for (const color of CROSS_COLORS) {
    const pieces = slots.map((pair, index) => pair.some(i => SOLVED[i] === COLOR_FACE[color]) ? index : -1).filter(i => i >= 0);
    function encode(pattern: KPattern): number {
      const edges = pattern.patternData.EDGES;
      return pieces.reduce((key, piece, i) => {
        const position = edges.pieces.indexOf(piece);
        return key + (position * 2 + edges.orientation[position]) * 24 ** i;
      }, 0);
    }
    const distances = new Uint8Array(24 ** 4).fill(255);
    const queue = new Uint32Array(190_080);
    const goal = encode(puzzle.defaultPattern());
    queue[0] = goal; distances[goal] = 0;
    let tail = 1;
    for (let head = 0; head < tail; head++) {
      const key = queue[head];
      for (const map of maps) {
        const next = step(key, map);
        if (distances[next] !== 255) continue;
        distances[next] = distances[key] + 1;
        queue[tail++] = next;
      }
    }
    expect(tail).toBe(190_080);
    const solver = new CrossSolver(color);
    expect(solver.distance(SOLVED)).toBe(0);
    expect(solver.query(SOLVED).nextMoves).toEqual([]);
    for (let difficulty = 1; difficulty <= 8; difficulty++) {
      const generated = solver.generate(difficulty);
      const graph = solver.graph(generated.startingState);
      expect(distances[encode(await patternFromFacelets(generated.startingState))]).toBe(difficulty);
      const visited = new Set<number>();
      const pending = [generated.startingState];
      while (pending.length) {
        const state = pending.pop()!;
        const key = encode(await patternFromFacelets(state));
        if (visited.has(key)) continue;
        visited.add(key);
        const expected = CROSS_MOVES.filter((_, i) => distances[step(key, maps[i])] === distances[key] - 1);
        const query = solver.query(state);
        const graphNode = graph.nodes[crossCoordinate(state, color)];
        expect(graphNode.distance).toBe(distances[key]);
        expect(graphNode.edges.map(edge => edge.move)).toEqual(expected);
        expect(query.distance).toBe(distances[key]);
        expect(query.nextMoves).toEqual(expected);
        expect(query.continuation).toHaveLength(distances[key]);
        expect(distances[encode(await patternFromFacelets(query.continuation.reduce(turn, state)))]).toBe(0);
        pending.push(...expected.map(move => turn(state, move)));
      }
      expect(Object.keys(graph.nodes)).toHaveLength(visited.size);
    }
  }
}, 120_000);
