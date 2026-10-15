import { expect, test } from '@playwright/test';
import { independentTarget } from './independent-target';
import type { CrossGraph } from '../src/domain/cross';

test('production worker exports both commuting optimal routes with a shared goal', async ({ page }) => {
  await page.goto('http://127.0.0.1:5175');
  const graph = await page.evaluate(async state => {
    const script = document.querySelector<HTMLScriptElement>('script[type="module"][src]')!;
    const bundle = await (await fetch(script.src)).text();
    const path = bundle.match(/\/assets\/cross\.worker-[\w-]+\.js/)?.[0];
    if (!path) throw new Error('Cross worker missing from production bundle');
    return new Promise<CrossGraph>((resolve, reject) => {
      const worker = new Worker(path, { type: 'module' });
      const timeout = setTimeout(() => { worker.terminate(); reject(new Error('Optimal graph timed out')); }, 20_000);
      worker.onerror = event => { clearTimeout(timeout); worker.terminate(); reject(new Error(event.message)); };
      worker.onmessage = event => {
        clearTimeout(timeout); worker.terminate();
        if (event.data.error) reject(new Error(event.data.error));
        else resolve(event.data.result as CrossGraph);
      };
      worker.postMessage({ id: 1, color: 'white', state, graph: true });
    });
  }, await independentTarget('R L'));
  expect(graph.nodes[graph.root].distance).toBe(2);
  expect(graph.nodes[graph.root].edges.map(edge => edge.move).sort()).toEqual(["L'", "R'"]);
  const paths = graph.nodes[graph.root].edges.map(edge => [edge.move, graph.nodes[edge.next].edges[0].move]);
  expect(paths).toEqual(expect.arrayContaining([["R'", "L'"], ["L'", "R'"]]));
  expect(Object.values(graph.nodes).filter(node => node.distance === 0)).toHaveLength(1);
  expect(Object.keys(graph.nodes)).toHaveLength(4);
});

test('production cross worker supports all exact difficulties and colors', async ({ page }) => {
  await page.goto('http://127.0.0.1:5175');
  const results = await page.evaluate(async source => {
    const script = document.querySelector<HTMLScriptElement>('script[type="module"][src]')!;
    const bundle = await (await fetch(script.src)).text();
    const path = bundle.match(/\/assets\/cross\.worker-[\w-]+\.js/)?.[0];
    if (!path) throw new Error('Cross worker missing from production bundle');
    const worker = new Worker(path, { type: 'module' });
    let id = 0;
    function request(color: string, difficulty: number, state?: string): Promise<{ result: { originalScramble: string; startingState: string; optimum: number }; metrics: { buildMilliseconds: number; tableBytes: number; peakTypedArrayBytes: number; maximumDistance: number; reachableStates: number; cachedTableBytes: number }; milliseconds: number }> {
      const started = performance.now();
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Cross worker timed out')), 30_000);
        worker.onerror = event => { clearTimeout(timeout); reject(new Error(event.message)); };
        worker.onmessage = event => {
          clearTimeout(timeout);
          if (event.data.error) reject(new Error(event.data.error));
          else resolve({ ...event.data, milliseconds: performance.now() - started });
        };
        worker.postMessage({ id: ++id, color, difficulty, state });
      });
    }
    const results = [];
    for (const color of ['white', 'yellow', 'red', 'orange', 'green', 'blue']) {
      for (let difficulty = 8; difficulty >= 1; difficulty--) results.push({ color, difficulty, prefix: '', ...await request(color, difficulty) });
    }
    results.push({ color: 'white', difficulty: 3, prefix: 'D', ...await request('white', 3, source) });
    worker.terminate();
    return results;
  }, await independentTarget('D'));
  for (const item of results) {
    expect(item.result.optimum).toBe(item.difficulty);
    expect(item.result.originalScramble.split(' ').length).toBeGreaterThanOrEqual(18);
    expect(item.result.originalScramble.split(' ').length).toBeLessThanOrEqual(25);
    expect(item.result.originalScramble.split(' ').length).toBeGreaterThan(item.difficulty);
    expect(item.result.startingState).toBe(await independentTarget(`${item.prefix} ${item.result.originalScramble}`.trim()));
    expect(item.metrics.maximumDistance).toBe(8);
    expect(item.metrics.reachableStates).toBe(190_080);
    expect(item.metrics.tableBytes).toBe(331_776);
    expect(item.metrics.peakTypedArrayBytes).toBe(1_092_528);
  }
  console.log('CROSS_DIFFICULTY_8_METRICS', JSON.stringify(results.filter(item => item.difficulty === 8).map(({ color, milliseconds, metrics }) => ({ color, milliseconds, ...metrics }))));
});

test('cross inspector commits alternative optimal branches and restores exact case', async ({ page }) => {
  await page.goto('http://127.0.0.1:5175');
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Enable Debug').click();
  if (await page.getByRole('dialog').count()) await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('link', { name: 'Debug', exact: true }).click();
  await page.getByRole('tab', { name: 'Cross cases', exact: true }).click();
  const section = page.getByRole('region', { name: 'Exact cross case inspector' });
  await expect(section.getByLabel('Cross color')).toHaveValue('white');
  await section.getByLabel('Exact difficulty').selectOption('8');
  await section.getByRole('button', { name: 'Generate cross case' }).click();
  await expect(section.getByLabel('Exact remaining distance')).toHaveText('8');
  await section.getByRole('button', { name: /^Inspect optimal move/ }).last().click();
  await expect(section.getByLabel('Exact remaining distance')).toHaveText('7');
  await section.getByRole('button', { name: 'Restore starting case' }).click();
  await expect(section.getByLabel('Exact remaining distance')).toHaveText('8');
  await expect(section.getByRole('alert')).toHaveCount(0);
});
