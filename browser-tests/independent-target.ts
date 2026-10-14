import { puzzles } from 'cubing/puzzles';

/** Independent cubing piece model mapped to standard URFDLB facelet order. */
export async function independentTarget(algorithm: string): Promise<string> {
  const solved = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
  const pattern = (await puzzles['3x3x3'].kpuzzle()).defaultPattern().applyAlg(algorithm);
  const result = [...solved];
  const slots = {
    CORNERS: [[8,9,20],[2,45,11],[0,36,47],[6,18,38],[29,26,15],[27,44,24],[33,53,42],[35,17,51]],
    EDGES: [[7,19],[5,10],[1,46],[3,37],[28,25],[32,16],[34,52],[30,43],[23,12],[21,41],[48,14],[50,39]],
  };
  for (const orbit of ['CORNERS', 'EDGES'] as const) {
    const data = pattern.patternData[orbit];
    slots[orbit].forEach((indices, location) => {
      indices.forEach((destination, orientation) => {
        const sourceOrientation = (orientation - data.orientation[location] + indices.length) % indices.length;
        result[destination] = solved[slots[orbit][data.pieces[location]][sourceOrientation]];
      });
    });
  }
  return result.join('');
}
