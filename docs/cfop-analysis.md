# CFOP solve timing

Completed solves show one timing bar beneath the cube. Open a saved result to
review the same breakdown offline. The four colors represent Cross, F2L, OLL,
and PLL. Select or focus a segment for its exact duration, and expand the text
details to review individual pairs and last-layer algorithms.

The bar partitions the recorded raw solve time. Inspection and penalties are
separate; changing +2 or DNF preserves the original breakdown and physical turns.
Skipped phases take no time, and final face alignment belongs to PLL execution.

Cross measures execution only. For each subsequent case, recognition runs from
the preceding completion to the first solution turn. Setup turns begin execution,
and pauses after execution starts remain part of execution. Recognition can be
zero. Adjacent exploratory U U' or U' U turns that restore the preceding state
before a solution remain in recognition and in the physical move history.

The app identifies the Cross color from the full solve and follows pairs in
their completion order. Normal algorithms temporarily disturb solved pieces;
completion is evaluated across case boundaries, allowing those internal turns.
Last-layer names come from a bundled, versioned catalog. An unfamiliar solution
can retain phase timing with an Unrecognized label. Names describe the performed
sequence without judging the solver's intent.

Saved full-cube states and ordered physical turns support offline replay. Where
those inputs cannot support a coherent breakdown, the result keeps its total and
move history and displays **Detailed timing unavailable**.

See the [catalog research](research/cfop-catalog.md) for coverage, source
attribution, variants, and validation.

## Offline algorithm identification

`analyzeLLAlgorithms(result, analysis)` returns the same case timing shape as F2L pair analysis, including stable catalog case and variant IDs when identified. It retains encompassing Unrecognized sections when a sequence cannot support a catalog split. Edge orientation supplies an independent two-look OLL boundary even for unknown sequences; a pause supplies none. Final alignment remains PLL execution.

Catalog notation is converted offline into intrinsic physical outer turns. The producer removes holding rotations and expands wide/slice equivalents; independent cubing transformations verify the physical sequence against every source variant. The runtime matcher accepts all four holdings around the automatically inferred cross axis, U setup/AUF, commuting opposite faces and equivalent quarter/half-turn spelling. It preserves the original move trace.

Milestone checks ignore the interiors of supported algorithm cores and independently evidenced state excursions that restore F2L/OLL with an orientation/permutation advance. Identity detours supply no advancement evidence. This distinguishes known algorithm-internal regressions from transient completion while retaining phase progress for unknown last-layer operations. Matching is bounded to 90 physical turns per candidate operation; longer unsupported operations retain state-based phase analysis and an encompassing Unrecognized section. A bounded cache reuses matches between phase and detail analysis.
