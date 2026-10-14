import { generatePracticeScramble } from '../domain/scramble-generator';
self.onmessage = async () => {
  try { self.postMessage({ scramble: await generatePracticeScramble() }); }
  catch (error) { self.postMessage({ error: String(error) }); }
};
