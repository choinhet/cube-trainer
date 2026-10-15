import { COLOR_FACE, type CrossColor } from '../../domain/cross';
import { FACES, normals, stickers } from '../../domain/cube';

const colors: Record<string, string> = { U: '#f5f5f5', D: '#f4d64e', R: '#e85b55', L: '#f49b46', F: '#58bc87', B: '#559be0' };
/** Top-down last-layer diagram with adjacent stickers to expose PLL permutation. */
export function LLCaseIcon({ state, crossColor, phase, label }: { state: string; crossColor: CrossColor; phase: 'OLL' | 'PLL'; label: string }) {
  const axis = normals[FACES.indexOf(COLOR_FACE[crossColor])].map(value => -value);
  const right = Math.abs(axis[0]) === 1 ? [0, 0, 1] : [1, 0, 0];
  const up = [axis[1] * right[2] - axis[2] * right[1], axis[2] * right[0] - axis[0] * right[2], axis[0] * right[1] - axis[1] * right[0]];
  const dot = (a: number[], b: number[]) => a.reduce((sum, value, i) => sum + value * b[i], 0);
  const topColor = FACES[normals.findIndex(normal => dot(normal, axis) === 1)];
  return <svg className="cfop-case-icon" width="64" height="64" viewBox="0 0 50 50" role="img" aria-label={label}>
    {stickers.flatMap((sticker, index) => {
      if (dot(sticker.position, axis) !== 1) return [];
      const x = 20 + dot(sticker.position, right) * 10;
      const y = 20 - dot(sticker.position, up) * 10;
      const sideX = dot(sticker.normal, right);
      const sideY = dot(sticker.normal, up);
      const top = dot(sticker.normal, axis) === 1;
      const fill = phase === 'OLL' ? state[index] === topColor ? '#f4d64e' : '#555b65' : colors[state[index]];
      return [<rect key={index} x={top ? x : sideX > 0 ? 41 : sideX < 0 ? 3 : x} y={top ? y : sideY > 0 ? 3 : sideY < 0 ? 41 : y} width={top || sideY !== 0 ? 9 : 6} height={top || sideX !== 0 ? 9 : 6} rx="1" fill={fill} />];
    })}
  </svg>;
}
