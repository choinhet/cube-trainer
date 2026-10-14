import { useEffect, useMemo } from 'react';
import { ExerciseQueue } from '../domain/exercise-queue';

export function useExerciseQueue<T>(generate: (signal: AbortSignal) => Promise<T>, enabled: boolean) {
  const queue = useMemo(() => new ExerciseQueue(generate), [generate, enabled]);
  useEffect(() => {
    if (enabled) queue.warm();
    return () => queue.dispose();
  }, [queue, enabled]);
  return useMemo(() => (signal: AbortSignal) => queue.take(signal), [queue]);
}
