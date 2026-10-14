import { expect, test } from '@playwright/test';
import { independentTarget } from './independent-target';

test('the production module worker generates validated nontrivial random-state targets', async ({ page }) => {
  await page.goto('http://127.0.0.1:5175');
  const targets = await page.evaluate(async () => {
    const script = document.querySelector<HTMLScriptElement>('script[type="module"][src]')!;
    const bundle = await (await fetch(script.src)).text();
    const path = bundle.match(/\/assets\/scramble\.worker-[\w-]+\.js/)?.[0];
    if (!path) throw new Error('Scramble worker not found in production bundle');
    const generate = () => new Promise<{ original: string; target: string; moves: string[] }>((resolve, reject) => {
      const worker = new Worker(path, { type: 'module' });
      const timeout = setTimeout(() => { worker.terminate(); reject(new Error('Production generation timed out')); }, 20_000);
      worker.onerror = event => { clearTimeout(timeout); worker.terminate(); reject(new Error(event.message)); };
      worker.onmessage = event => {
        clearTimeout(timeout); worker.terminate();
        if (event.data.error) reject(new Error(event.data.error));
        else resolve(event.data.scramble);
      };
      worker.postMessage({ type: 'generate' });
    });
    return [await generate(), await generate()];
  });
  for (const scramble of targets) {
    expect(scramble.target).toBe(await independentTarget(scramble.original));
    expect(scramble.target).toHaveLength(54);
    expect(scramble.moves.every(move => /^[URFDLB](2|')?$/.test(move))).toBe(true);
    expect(scramble.original).toBe(scramble.moves.join(' '));
    for (const face of 'URFDLB') expect([...scramble.target].filter(color => color === face)).toHaveLength(9);
  }
});
