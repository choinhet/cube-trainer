import type { CrossColor } from './cross';

// Proper rotations preserve turn direction. Each map converts intrinsic URFDLB faces.
const frames: Record<CrossColor, { faces: string; top: CrossColor; front: CrossColor }> = {
  white: { faces: 'DLFURB', top: 'yellow', front: 'green' },
  yellow: { faces: 'URFDLB', top: 'white', front: 'green' },
  red: { faces: 'RDFLUB', top: 'orange', front: 'green' },
  orange: { faces: 'LUFRDB', top: 'red', front: 'green' },
  green: { faces: 'FRDBLU', top: 'blue', front: 'white' },
  blue: { faces: 'BRUFLD', top: 'green', front: 'yellow' },
};

export function bottomCrossMove(move: string, color: CrossColor): string {
  return frames[color].faces['URFDLB'.indexOf(move[0])] + move.slice(1);
}
export function bottomCrossHolding(color: CrossColor): string {
  const frame = frames[color];
  return `${color} on bottom, ${frame.top} on top, ${frame.front} in front`;
}
