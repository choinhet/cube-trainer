import { randomScrambleForEvent } from 'cubing/scramble';
import { validateScramble, type PracticeScramble } from './scramble';

/** cubing's 333 random-state solver, never a random walk of a fixed length. */
export async function generatePracticeScramble(): Promise<PracticeScramble> {
  return validateScramble((await randomScrambleForEvent('333')).toString());
}
