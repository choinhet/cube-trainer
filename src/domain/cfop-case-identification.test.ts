import { expect, test } from 'vitest';
import { ALGORITHM_CATALOG } from './algorithm-catalog';
import { identifyLLCase } from './cfop-case-identification';
import { CROSS_COLORS, COLOR_FACE } from './cross';
import { FACES, normals, SOLVED, turn } from './cube';
import { inverse } from './guidance';

test('identifies every PLL case across all cross colors and initial/final AUF', () => {
  const cases = ALGORITHM_CATALOG.filter(entry => entry.phase === 'PLL' && entry.look === 'one-look');
  expect(cases).toHaveLength(21);
  for (const color of CROSS_COLORS) {
    const up = normals[FACES.indexOf(COLOR_FACE[color])].map(v => -v);
    const front = normals.find(n => n.every((v, i) => v * up[i] === 0))!;
    const right = [up[1] * front[2] - up[2] * front[1], up[2] * front[0] - up[0] * front[2], up[0] * front[1] - up[1] * front[0]];
    const map = normals.map(n => FACES[normals.findIndex(c => c.every((v, i) => v === n[0] * right[i] + n[1] * up[i] + n[2] * front[i]))]);
    for (const entry of cases) {
      const undo = entry.variants[0].physicalTurns.map(m => map[FACES.indexOf(m[0])] + m.slice(1)).reverse().map(inverse);
      let finish = SOLVED;
      for (let final = 0; final < 4; final++) {
        let state = undo.reduce(turn, finish);
        for (let initial = 0; initial < 4; initial++) {
          expect(identifyLLCase(state, color, 'PLL')?.id, `${color} ${entry.name}`).toBe(entry.id);
          state = turn(state, map[0]);
        }
        finish = turn(finish, map[0]);
      }
    }
  }
}, 20000);

