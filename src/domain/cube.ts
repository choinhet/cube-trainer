export const SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
export const FACES = 'URFDLB';
type Vector = [number, number, number];
export const normals: Vector[] = [[0,1,0],[1,0,0],[0,0,1],[0,-1,0],[-1,0,0],[0,0,-1]];
const rights: Vector[] = [[1,0,0],[0,0,-1],[1,0,0],[1,0,0],[0,0,1],[-1,0,0]];
const ups: Vector[] = [[0,0,-1],[0,1,0],[0,1,0],[0,0,1],[0,1,0],[0,1,0]];
const dot = (a: Vector, b: Vector): number => a.reduce((sum, value, i) => sum + value * b[i], 0);
export const stickers = normals.flatMap((normal, face) => Array.from({ length: 9 }, (_, i) => ({
  normal,
  position: normal.map((value, axis) => value + rights[face][axis] * (i % 3 - 1) + ups[face][axis] * (1 - Math.floor(i / 3))) as Vector,
})));
function clockwise(vector: Vector, axis: Vector): Vector {
  const [x,y,z] = vector;
  const [a,b,c] = axis;
  const projection = dot(vector, axis);
  return [a * projection - (b*z-c*y), b * projection - (c*x-a*z), c * projection - (a*y-b*x)];
}
export function turn(facelets: string, move: string): string {
  if (!/^[URFDLB](2|')?$/.test(move)) throw new Error('Invalid outer-face turn');
  const axis = normals[FACES.indexOf(move[0])];
  let result = facelets;
  const count = move.endsWith('2') ? 2 : move.endsWith("'") ? 3 : 1;
  for (let iteration = 0; iteration < count; iteration++) {
    const next = result.split('');
    stickers.forEach((sticker, from) => {
      if (dot(sticker.position, axis) !== 1) return;
      const position = clockwise(sticker.position, axis);
      const normal = clockwise(sticker.normal, axis);
      const to = stickers.findIndex(candidate => candidate.position.every((v,i) => v === position[i]) && candidate.normal.every((v,i) => v === normal[i]));
      next[to] = result[from];
    });
    result = next.join('');
  }
  return result;
}
export function isFacelets(value: string): boolean {
  if (value.length !== 54 || ![...FACES].every((face, i) => value[9*i+4] === face && [...value].filter(v => v === face).length === 9)) return false;
  const corners = [[8,9,20],[6,18,38],[0,36,47],[2,45,11],[29,26,15],[27,44,24],[33,53,42],[35,17,51]];
  const edges = [[5,10],[7,19],[3,37],[1,46],[32,16],[28,25],[30,43],[34,52],[23,12],[21,41],[50,39],[48,14]];
  function pieces(positions: number[][]): { permutation: number[]; orientation: number[] } {
    const reference = positions.map(indices => indices.map(index => SOLVED[index]).join(''));
    const permutation: number[] = [];
    const orientation: number[] = [];
    for (const indices of positions) {
      const colors = indices.map(index => value[index]);
      let piece = -1;
      let offset = 0;
      for (; offset < colors.length; offset++) {
        const rotated = colors.slice(offset).concat(colors.slice(0, offset)).join('');
        piece = reference.indexOf(rotated);
        if (piece !== -1) break;
      }
      permutation.push(piece);
      orientation.push(offset);
    }
    return { permutation, orientation };
  }
  const cp = pieces(corners);
  const ep = pieces(edges);
  const unique = (permutation: number[]): boolean => !permutation.includes(-1) && new Set(permutation).size === permutation.length;
  const parity = (permutation: number[]): number => permutation.reduce((sum, value, i) => sum + permutation.slice(i + 1).filter(next => next < value).length, 0) % 2;
  return unique(cp.permutation) && unique(ep.permutation)
    && cp.orientation.reduce((sum, value) => sum + value, 0) % 3 === 0
    && ep.orientation.reduce((sum, value) => sum + value, 0) % 2 === 0
    && parity(cp.permutation) === parity(ep.permutation);
}
export function isSolved(facelets: string): boolean { return facelets === SOLVED; }
