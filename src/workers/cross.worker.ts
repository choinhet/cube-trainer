import { CrossSolver, type CrossColor } from '../domain/cross';

const cache = new Map<CrossColor, CrossSolver>();
self.onmessage = (event: MessageEvent<{ id: number; color: CrossColor; difficulty?: number; state?: string; graph?: boolean }>) => {
  const { id, color, difficulty, state, graph } = event.data;
  try {
    let solver = cache.get(color);
    if (!solver) { solver = new CrossSolver(color); cache.set(color, solver); }
    const result = difficulty !== undefined ? solver.generate(difficulty, state) : graph ? solver.graph(state ?? '') : solver.query(state ?? '');
    self.postMessage({ id, result, metrics: { ...solver.metrics, cachedTableBytes: cache.size * solver.metrics.tableBytes } });
  } catch (error) { self.postMessage({ id, error: String(error) }); }
};
