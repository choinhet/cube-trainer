import type { CrossColor } from '../domain/cross';
import { bottomCrossHolding, bottomCrossMove } from '../domain/cross-orientation';

interface Guide { sequence: string[]; progress: number; provisional: boolean; undo: string[]; remaining: string[] }
export function GuidanceSteps({ guide, status, crossColor, mirrored = true }: { guide: Guide; status: string; crossColor?: CrossColor; mirrored?: boolean }) {
  const correction = status === 'correction';
  const moves = correction ? guide.undo.map(move => crossColor && mirrored ? bottomCrossMove(move, crossColor) : move) : guide.sequence;
  return <div className={`move-guidance ${correction ? 'correction' : ''}`}>
    {crossColor && <p className="holding-instructions">Hold {correction && mirrored ? bottomCrossHolding(crossColor) : 'white on top, green in front'}.</p>}
    {correction && <p className="correction-label">Undo</p>}
    <ol className="move-sequence" aria-label={correction ? 'Undo moves' : 'Actual setup moves'}>{moves.map((move, index) => <li key={index} data-completed={!correction && index < guide.progress} aria-current={index === (correction ? 0 : guide.progress) ? 'step' : undefined}><span className="sr-only">{!correction && index < guide.progress ? 'Completed ' : index === (correction ? 0 : guide.progress) ? 'Current ' : ''}</span>{move}</li>)}</ol>
  </div>;
}
