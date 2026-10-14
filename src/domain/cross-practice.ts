import type { CrossCase, CrossColor } from './cross';
import type { CrossPersistence, CrossRecord } from './cross-attempt';
import type { CrossFlow } from './cross-flow';
import type { SetupSolver } from './setup';
import type { CrossMode, CrossOptions } from './cross-guidance';
export type CrossGenerator = (color: CrossColor, difficulty: number, signal: AbortSignal) => Promise<CrossCase>;
export type CrossSnapshot = ReturnType<CrossFlow['snapshot']>;
export interface CrossPracticeController {
  readonly cross: CrossSnapshot | null;
  readonly previousCross?: CrossRecord | null;
  readonly canPractice: boolean;
  readonly activity: string;
  readonly preparation: unknown;
  startCrossPreparation(sessionId: string, color: CrossColor, difficulty: number, store: CrossPersistence, generate?: CrossGenerator, solve?: SetupSolver, options?: CrossOptions): Promise<void>;
  cancelCrossPractice(): void;
  replaceCrossPreparation(): Promise<void>;
  switchCrossMode(mode: CrossMode): Promise<void>;
  revealCrossSolution(): Promise<void>;
  retryCrossSave(): void;
  checkpointCross(): void;
  requireResynchronization(): void;
}
