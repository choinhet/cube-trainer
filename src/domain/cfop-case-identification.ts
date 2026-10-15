import { ALGORITHM_CATALOG, type CatalogCase } from './algorithm-catalog';
import { COLOR_FACE, type CrossColor } from './cross';
import { FACES, normals, SOLVED, stickers, turn } from './cube';
import { inverse } from './guidance';

type Step = 'one-look' | 'edges' | 'corners';
const indexes = new Map<string, Map<string, CatalogCase>>();
const dot = (a: number[], b: number[]) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// Reuse sticker permutations while generating the offline case index.
const permutations = new Map<string, number[]>();
function applyTurn(state: string, move: string): string {
  let permutation = permutations.get(move);
  if (!permutation) {
    const labels = Array.from({ length: 54 }, (_, i) => String.fromCharCode(65 + i)).join('');
    permutation = [...turn(labels, move)].map(value => value.charCodeAt(0) - 65);
    permutations.set(move, permutation);
  }
  return permutation.map(index => state[index]).join('');
}
/** Classifies the starting case, independently of the algorithm actually executed. */
export function identifyLLCase(state: string, color: CrossColor, phase: 'OLL' | 'PLL', step: Step = 'one-look'): CatalogCase | undefined {
  const up = normals[FACES.indexOf(COLOR_FACE[color])].map(value => -value);
  const top = FACES[normals.findIndex(normal => dot(normal, up) === 1)];
  const signature = (position: string) => phase === 'PLL' ? position : [...position].flatMap((value, i) => {
    // Edge orientation is independent of the corner configuration in two-look OLL.
    if (step === 'edges' && stickers[i].position.filter(v => v !== 0).length !== 2) return [];
    return [value === top ? '1' : '0'];
  }).join('');
  const cacheKey = `${color}:${phase}:${step}`;
  let index = indexes.get(cacheKey);
  if (!index) {
    index = new Map();
    const cases = ALGORITHM_CATALOG.filter(entry => entry.phase === phase && (step === 'one-look' ? entry.look === 'one-look' : entry.look === 'two-look' && entry.step === step));
    for (const front of normals.filter(normal => dot(normal, up) === 0)) {
      const right = cross(up, front);
      const faces = normals.map(normal => FACES[normals.findIndex(candidate => candidate.every((value, i) => value === normal[0] * right[i] + normal[1] * up[i] + normal[2] * front[i]))]);
      for (const entry of cases) for (const variant of entry.variants) {
        const undo = variant.physicalTurns.map(move => faces[FACES.indexOf(move[0])] + move.slice(1)).reverse().map(inverse);
        // Include both initial alignment and final AUF, without assuming either was executed.
        let finish = SOLVED;
        for (let finalAUF = 0; finalAUF < 4; finalAUF++) {
          let start = undo.reduce(applyTurn, finish);
          for (let initialAUF = 0; initialAUF < 4; initialAUF++) {
            index.set(signature(start), entry);
            start = applyTurn(start, top);
          }
          finish = applyTurn(finish, top);
        }
      }
    }
    indexes.set(cacheKey, index);
  }
  return index.get(signature(state));
}

