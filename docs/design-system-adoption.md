# Design-system adoption (historical)

This is the historical adoption and verification record preceding Competition Stage. Its test counts describe that implementation and do not certify the later redesign. Current visual authority is [DESIGN.md](../DESIGN.md); redesign review evidence is recorded in [the finish review](../.scratch/app-redesign/finish-review.md). Preserve the behavioral findings and explicit user feedback below as history, with final styling governed by the approved redesign.

Implemented on 2026-10-15 from the six local tickets in `.scratch/design-system-adoption/issues/` and [the agreed design guide](design-system.md).

The implementation covers shared tokens and controls; Settings and Device; Solve analysis and saved details; Cross training and saved details; Import shared scramble and New session; navigation, Insights, and Debug. Existing training, persistence, correction, repeat-attempt, and diagnostic workflows remain covered by the existing behavioral suites. Insights adds no analytics features.

## Standards

The independent standards review found one documented violation: new modal, Solve, and Debug CSS repeated typography sizes instead of consuming the shared tokens required by the guide. These declarations now use the shared typography tokens.

The review also noted possible duplicated presentation logic between compact Cross details and noncompact Cross history. This is a low-priority heuristic rather than a standards violation; the different compositions retain their existing responsibilities.

Total: one documented finding, corrected; one optional smell. The documented typography violation was the worst finding on this axis.

## Spec

The independent specification review found three issues:

1. Primary Solve TPS used normalized half turns while history counted physical events. Overall metrics now use the same definition as history; step metrics explicitly name and explain their different normalization.
2. The Cross import action remained a Plus icon with a native tooltip. It now has a visible label and no duplicate native tooltip.
3. Proportional timeline segments could be too narrow for touch. Equivalent step-table controls now provide 44px minimum targets and reveal both recognition and execution details.

All three findings were corrected. No unrequested product behavior was identified. The inconsistent TPS measurement was the worst finding on this axis.

Integrated checks also corrected modal Escape handling, autofocus form opener restoration, a leaked internal case ID, and Cross failed-save action overflow. Regression tests cover these interactions.

## Verification

Verification uses the agreed React component and Playwright browser interfaces. Browser coverage includes both themes, desktop and mobile layouts, enlarged text and narrow reflow, long scrambles and labels, bounded tables, keyboard selection and dismissal, focus containment/restoration, form recovery, penalty changes, saved history, interrupted attempts, and worker execution. Text-token contrast checks pass at 4.5:1 or better in both themes.

Screenshots are generated under `docs/design-review/screenshots/` and `test-results/`; these generated directories remain ignored. Current verification after the presentation corrections below: 341 unit/component tests and all 72 browser tests passed. Production build (including TypeScript checking), ESLint, and whitespace validation passed. Physical Bluetooth hardware was not exercised; connection workflows use the existing browser harnesses.

## Presentation corrections after user feedback

The initial migration passed its checks but regressed the preferred interface. The hover card had moved into normal document flow, changing the analysis height on hover, while the new live analysis scroll container clipped its content. The 36px timeline, right-aligned columns, tooltip-wrapped close button, and extra navbar underline were also unwanted changes.

User feedback on 2026-10-15 supersedes those initial choices:

- Restore the compact floating case card in live Solve and saved details. Hover does not move surrounding content; the card is anchored to its phase or table header and flips above when space below is insufficient. Click/keyboard pinning and Escape dismissal remain available.
- Keep the timeline 14px high. Table controls retain their larger activation targets.
- Center history values and phase-table data headers. Keep the selected navbar background without an additional bottom underline.
- Use a named X button without a tooltip for closing dialogs and pinned cards.
- Center the cube and timer together without reducing the cube after completion. Live analysis follows normal page scrolling, with horizontal scrolling only where a dense table needs it.
- Remove Cancel preparation. Existing navigation cancellation and active-solve abandonment still work.

The presentation regression checks failed before the correction and passed afterward. Six additional browser cases cover floating cards without layout shifts, viewport bounds, thin timelines, centered history/navigation and Cross presentation, and live page scrolling at 1280px and 375px. Earlier viewport checks now allow intentional vertical page scrolling while retaining horizontal overflow checks.
