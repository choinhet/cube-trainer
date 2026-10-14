import { KPattern } from 'cubing/kpuzzle';
import { puzzles } from 'cubing/puzzles';
import { isFacelets, SOLVED } from './cube';
import { experimentalSolve3x3x3IgnoringCenters } from 'cubing/search';
import { normalizeTurns } from './guidance';
import { withSetupMinimum, validateSetup, validateTarget, type ExerciseSetup, type ExerciseTarget } from './setup';

export async function computeSetup(source: string, target: ExerciseTarget): Promise<ExerciseSetup> {
  let moves = validateTarget(target);
  if (!isFacelets(source)) throw new Error('A valid full cube state is required');
  if (source === target.target) moves = [];
  else if (source !== (target.source ?? SOLVED) || (target.minimumSetupMoves && moves.length > 25)) {
    const from = (await patternFromFacelets(source)).experimentalToTransformation();
    const to = (await patternFromFacelets(target.target)).experimentalToTransformation();
    if (!from || !to) throw new Error('Cube positions cannot be converted to transformations');
    // Solving T^-1 S yields S^-1 T: a direct route from the current cube to the target.
    const relative = to.invert().applyTransformation(from).toKPattern();
    const solution = (await experimentalSolve3x3x3IgnoringCenters(relative)).toString().trim();
    moves = solution ? solution.split(/\s+/) : [];
  }
  // Setup algorithms may simplify across cancellations; physical metrics never do.
  let previous: string;
  do { previous = moves.join(' '); moves = normalizeTurns(moves); } while (moves.join(' ') !== previous);
  return withSetupMinimum(validateSetup(source, target.target, { source, target: target.target, moves }), target.minimumSetupMoves);
}

/** Standard URFDLB stickers in cubing's orbit order. Centers stay fixed. */
export async function patternFromFacelets(facelets: string): Promise<KPattern> {
  if (!isFacelets(facelets)) throw new Error('A valid full cube state is required');
  const puzzle = await puzzles['3x3x3'].kpuzzle();
  const data = structuredClone(puzzle.defaultPattern().patternData);
  const slots = {
    CORNERS: [[8,9,20],[2,45,11],[0,36,47],[6,18,38],[29,26,15],[27,44,24],[33,53,42],[35,17,51]],
    EDGES: [[7,19],[5,10],[1,46],[3,37],[28,25],[32,16],[34,52],[30,43],[23,12],[21,41],[48,14],[50,39]],
  };
  for (const orbit of ['CORNERS', 'EDGES'] as const) {
    const reference = slots[orbit].map(indices => indices.map(i => SOLVED[i]).join(''));
    slots[orbit].forEach((indices, location) => {
      const colors = indices.map(i => facelets[i]);
      for (let offset = 0; offset < indices.length; offset++) {
        const piece = reference.indexOf(colors.slice(offset).concat(colors.slice(0, offset)).join(''));
        if (piece < 0) continue;
        data[orbit].pieces[location] = piece;
        data[orbit].orientation[location] = offset;
        break;
      }
    });
  }
  return new KPattern(puzzle, data);
}
