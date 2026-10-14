# Cube Trainer

Practice for solving a selected-color cross efficiently on a physical cube.

## Language

**Cross case**:
A full-cube starting position together with a selected cross color and its exact optimal move count.
_Avoid_: Cross-only scramble

**Difficulty**:
The number of face turns in the shortest solution for the selected cross, counting a quarter turn or half turn as one move.
_Avoid_: Scramble length

**Compatible optimal solution**:
An optimal solution whose completed moves match the attempt's accepted move prefix.

**Valid prefix**:
Completed moves that begin at least one optimal solution for the case.

**Provisional turn**:
A physical quarter turn whose interpretation as a completed quarter turn or the first part of a half turn is still open.

**Correction**:
Physical recovery to the exact full-cube position at the last valid prefix before optimal-path training resumes.
_Avoid_: Restart, new solution

**Executed move count**:
The number of moves physically performed in an attempt, counting a half turn as one move and counting inverse turns, mistakes, and correction activity rather than canceling them.

**Repeat attempt**:
A new attempt at the same full-cube starting position, cross color, and difficulty.

**Shared scramble**:
A face-turn algorithm that reproduces a cross case's full-cube starting position from a solved cube, held with white on top and green in front.

**Setup algorithm**:
A face-turn algorithm that takes the cube's current full position to a cross case's full starting position.
_Avoid_: Shared scramble

**Bottom-cross instructions**:
Move instructions expressed with the selected cross color on the bottom and a specified front color.
_Avoid_: Reflected turns

**Mixed-mode attempt**:
A cross attempt whose practice mode changes before completion. Its elapsed time and performed moves belong to one attempt across those changes.
