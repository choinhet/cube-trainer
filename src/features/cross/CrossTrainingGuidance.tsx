import type { CrossSnapshot } from '../../domain/cross-practice';
import { bottomCrossHolding, bottomCrossMove } from '../../domain/cross-orientation';

export function CrossTrainingGuidance({ cross, mirrored = true }: { cross: CrossSnapshot; mirrored?: boolean }) {
  const guide = cross.guidance;
  if (!guide) return null;
  const displayMove = (move: string) => mirrored ? bottomCrossMove(move, cross.case.color) : move;
  return <div className="move-guidance" aria-label="Cross training guidance">
    {(cross.mode === 'fully-guided' || guide.status === 'correction') && <p className="holding-instructions">Hold {mirrored ? bottomCrossHolding(cross.case.color) : 'white on top, green in front'}.</p>}
    {cross.mode === 'fully-guided' && <ol className="move-sequence" aria-label="Optimal cross algorithm">{guide.sequence.map((move, index) => <li key={index} data-completed={index < guide.completedMoves.length} aria-current={index === guide.completedMoves.length ? 'step' : undefined}><span className="sr-only">{index < guide.completedMoves.length ? 'Completed ' : index === guide.completedMoves.length ? 'Current ' : ''}</span>{displayMove(move)}</li>)}</ol>}
    {cross.mode === 'semi-guided' && cross.phase !== 'finished' && <p>{guide.completedMoves.length} of {cross.case.optimum} optimal moves completed</p>}
    {guide.provisional && <p role="status">Turn in progress — waiting for the next face or a half turn.</p>}
    {guide.status === 'correction' && <div className="correction"><p className="correction-label" role="status">Undo to the last valid position</p><ol className="move-sequence" aria-label="Undo moves">{guide.undo.map((move, index) => <li key={index} aria-current={index === 0 ? 'step' : undefined}>{displayMove(move)}</li>)}</ol></div>}
  </div>;
}
