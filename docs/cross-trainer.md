# Cross trainer

Choose any cross color (default white) and an exact difficulty from 1 to 8.
Difficulty is the shortest solution length for that color's cross, with its
edges aligned to the adjacent centers. Each case scrambles the whole cube.

## Modes

- **Free** accepts any approach. The solution stays hidden until requested.
  Completion compares executed moves with the optimum.
- **Semi-guided** hides the algorithm and accepts moves on any compatible
  optimal route. Mistakes show undo guidance.
- **Fully-guided** shows an optimal algorithm. Choosing another optimal route
  switches its continuation while keeping completed moves visible. Mistakes
  use the same undo guidance. These attempts are assisted from the start.

Mode can change during preparation or an active attempt without replacing the
case or resetting performed moves. Color and difficulty stay locked during an
active attempt. Entering a guided mode checks all recorded turns against the
original case's optimal paths; earlier exploration can require undo to the last
valid position. Free mode permits continuing without that correction.

Elapsed time runs from the first solve turn across mode changes, with the timer
shown in Free mode. History labels attempts with mode changes **Mixed**, shows
their mode transitions and elapsed time in details, and excludes their timing
from Free-only statistics. Once an algorithm has been displayed or revealed,
the attempt remains assisted even after switching modes.

## Sharing and importing

The scramble and copy icon reproduce the exact full-cube starting position from
a solved cube with **white on top and green in front**. This also applies to the
scramble in saved attempt details, including older cases originally generated
from an unsolved cube. The shareable scramble can differ from the actual setup
algorithm because the connected cube may already be scrambled.

The **plus button** opens an import modal for face turns (`R`, `U2`, `F'`, etc.).
Choose the cross color; difficulty is calculated automatically. Import interprets
the pasted algorithm from solved, then prepares that exact target from the cube's
current position. Invalid notation and already-solved crosses are rejected before
replacing the existing attempt. An unfinished solve is saved as abandoned; an
unfinished preparation is cancelled without a solve result.

## Instruction orientation

**Mirrored instructions for the cross trainer** is enabled by default in Settings.
It presents correction and cross solution moves with the selected cross on the
bottom. For white, hold yellow on top and green in front. Holding instructions
specify the front for every color. This uses a proper cube rotation and preserves
clockwise/inverse directions; telemetry and move counting stay in the cube's
intrinsic frame. Disable the checkbox to use white-up, green-front instructions.
Shared scrambles and actual setup algorithms always use white-up, green-front
notation; setup correction uses the selected instruction setting.

## Physical turns and correction

A quarter turn, its inverse, and a half turn each cost one move. Adjacent
matching quarter-turn events count as a half turn, in either direction, with
no timing cutoff. Opposite-direction activity does not cancel from the count:
`R R` counts as one move; `R R'` counts as two. Extra revolutions, mistakes,
and correction activity also count. Holding and regripping the cube cost zero;
device face names follow center colors, independently of gyro orientation.

In guided modes, a lone quarter turn stays provisional until another face is
turned or the cross completes. A matching second quarter commits the half turn.
A quarter turn that cannot match either an optimal quarter turn or the first
part of an optimal half turn enters correction immediately.

Correction restores the exact full-cube state at the last valid prefix, not
merely its cross edges. Further turns update the undo guidance. Any sequence
that restores that state is accepted, and training resumes with the same valid
prefix. Solving the cross while still in correction does not complete an attempt.

## Completion and repeated attempts

Completion keeps the case visible. **Retry same case** prepares the same full
starting position and creates a separate result. **Next case** prepares a new
case. Free-mode **Reveal cross solution** shows a solution from the original
starting position and marks that attempt assisted, including when revealed
after saving. Repeating a case hides the Free-mode solution again.

Retry setup solves the direct relative position from the current cube to the
original full starting state. It targets **15–25 moves**, with half turns counting
as one move. Verified identity sequences extend routes shorter than 15 moves
without changing the endpoint. A verified route longer than 25 is allowed if
returned by the solver; 25 is a target rather than a guaranteed solver bound.
A cube already at the target arms the new attempt without setup moves. Setup
activity does not count toward the attempt's time or executed move count.

Attempts save their mode, physical trace, executed count, optimum, mistake
episodes, and assistance metadata in browser-local history. Older saved counts
retain their original values; new attempts use activity counting rather than
canceling inverse turns.

## Optimal-path representation

The existing exact breadth-first solver runs in a worker. For guided cases, it
exports the complete graph of distance-decreasing transitions from the case's
cross coordinate. Every graph route to distance zero is an optimal solution.
Nodes are shared when different prefixes reach the same cross coordinate; the
accepted prefix and exact full-cube correction anchor remain attempt-specific.
No optimal route is discarded to favor the displayed algorithm.

Recovered ordered move events are processed normally. An authoritative state
change without the corresponding recorded turns interrupts guided practice,
because its accepted prefix and executed count cannot be reconstructed reliably.
