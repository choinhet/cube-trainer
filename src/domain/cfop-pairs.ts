import { cfopProgress, type CFOPAnalysis } from './cfop-analysis';
import type { TimedResult } from './timed-attempt';

export interface CFOPCase {
  id: string;
  label: string;
  phase: 'F2L' | 'OLL' | 'PLL';
  startIndex: number;
  solutionStartIndex: number;
  endIndex: number;
  startMs: number;
  executionStartMs: number;
  endMs: number;
  recognitionMs: number;
  executionMs: number;
}
/** Cases are bounded by restored Cross checkpoints, permitting insertion turns. */
export function analyzeF2LPairs(result: TimedResult, analysis: CFOPAnalysis): CFOPCase[] {
  const phase = analysis.phases.find(value => value.phase === 'F2L')!;
  const progress = analysis.states.map(state => cfopProgress(state, analysis.crossColor));
  const checkpoints = progress.flatMap((value, index) => index >= phase.startIndex && index <= phase.endIndex && value.cross ? [index] : []);
  const completed = [0, 1, 2, 3].map(pair => ({ pair, index: checkpoints.find(index => progress[index].pairs[pair] && checkpoints.filter(next => next >= index).every(next => progress[next].pairs[pair])) ?? phase.endIndex })).sort((a, b) => a.index - b.index || a.pair - b.pair);
  let previousIndex = phase.startIndex;
  let previousMs = phase.startMs;
  return completed.map(({ pair, index }, order) => {
    const endMs = index === phase.endIndex ? phase.endMs : index === 0 ? 0 : analysis.moveTimesMs[index - 1];
    let solutionStartIndex = Math.min(previousIndex, index);
    while (solutionStartIndex + 2 < index) {
      const first = result.rawTurns?.[solutionStartIndex]?.move;
      const second = result.rawTurns?.[solutionStartIndex + 1]?.move;
      if (!((first === 'U' && second === "U'") || (first === "U'" && second === 'U')) || analysis.states[solutionStartIndex] !== analysis.states[solutionStartIndex + 2]) break;
      solutionStartIndex += 2;
    }
    const executionStartMs = index === previousIndex ? previousMs : analysis.moveTimesMs[solutionStartIndex];
    const detail: CFOPCase = { id: `pair-${pair}`, label: `F2L pair ${order + 1}`, phase: 'F2L', startIndex: previousIndex, solutionStartIndex, endIndex: index, startMs: previousMs, executionStartMs, endMs, recognitionMs: executionStartMs - previousMs, executionMs: endMs - executionStartMs };
    previousIndex = index; previousMs = endMs;
    return detail;
  });
}
