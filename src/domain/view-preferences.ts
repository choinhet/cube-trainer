export const DEFAULT_VIEW_ANGLE = 25;
export const MIN_VIEW_ANGLE = 5;
export const MAX_VIEW_ANGLE = 85;

export function isValidViewAngle(angle: number): boolean {
  return Number.isFinite(angle) && angle >= MIN_VIEW_ANGLE && angle <= MAX_VIEW_ANGLE;
}
