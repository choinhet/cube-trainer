# Design-system adoption

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

Screenshots are generated under `docs/design-review/screenshots/` and `test-results/`; these generated directories remain ignored. Final verification: 341 unit/component tests and all 66 browser tests passed. Production build (including TypeScript checking), ESLint, and whitespace validation passed. Physical Bluetooth hardware was not exercised; connection workflows use the existing browser harnesses.
