# Design system

Status: agreed design direction; implementation is incremental.

This guide records the design planning session approved on 2026-10-15. Use it when designing or changing screens, modals, controls, or visual styles. It defines the target system; it does not claim that the current interface already conforms.

## Product principles

- Preserve the dark, precise, data-focused character of the training interface.
- Prefer icons for actions and navigation. Keep visible text for values, units, settings names, ambiguous choices, and information that users need to understand a result.
- Keep essential information visible. Reduce repetition and improve hierarchy before moving information into disclosures.
- Teach each behavior once: equivalent actions use the same icon, placement, feedback, and interaction across screens.
- Prioritize alignment, spacing, font sizes, readability, and predictable behavior over decoration.

Scope covers Solve, Cross Trainer, Insights, optional Debug, and every modal. Insights work covers its existing shell and shared components; new charts and reports require separate feature planning. Retain compatibility with existing theme support while using dark mode as the primary visual reference.

## Visual foundations

Define shared tokens in `src/styles/workspace.css`; components consume these tokens instead of creating local scales. The following sizes are starting specifications to verify on actual screens.

| Area | Target rule |
| --- | --- |
| Typography | System font stack; 16px base text, 14px dense data and controls, 12px secondary annotations only. |
| Hierarchy | Use a small heading scale and restrained weight changes. Keep the timer as the dominant result. |
| Numbers | Tabular numerals for timers and metrics. Right-align numeric table cells and their headers; left-align descriptive labels. |
| Spacing | Use the 4px scale: 4, 8, 12, 16, 24, 32px. Related elements sit closer than separate sections. |
| Controls | Consistent heights within a control group. Start with 36px desktop controls; provide at least 44px touch targets, using responsive sizing or hit areas. |
| Icons | Use the existing Lucide family, consistent stroke and optical size, and centered alignment. Start at 20px for standard actions. |
| Surfaces | Neutral canvas, surface, and subtle raised/selected treatments; borders separate content only where useful. |
| Shape | Reuse the existing 8px control and 16px modal radii; shared panel styles own their radius. |
| Text contrast | Verify at least 4.5:1 for normal text and 3:1 for large text. Secondary text must remain readable. |

Align section edges to a common content grid. Align labels and values consistently within groups. Center the timer and cube presentation where appropriate; use deliberate row and column alignment for analysis and settings. Avoid shrinking text to make dense content fit.

### Color semantics

Use semantic tokens for text, muted text, canvas, surface, border, accent, danger, and status. Reserve expressive color for cube phases, selection, status, and meaningful emphasis. Use a stable phase palette across timelines, legends, and analysis views. Cube sticker colors retain their domain meaning.

Pair status colors with an icon or text. Distinguish recognition from execution with a consistent visual treatment and visible legend. An active phase needs a persistent selection marker beyond its color. Exact palette values remain implementation choices subject to contrast and readability checks.

## Icons, labels, and explanations

Use the same icon for the same action everywhere. Reuse `IconButton` for icon actions, with an accessible name and a short action-oriented tooltip such as "Copy scramble". Stateful actions expose their current state and next action clearly, such as "Disconnect cube" when connected.

Prefer icon-only actions and navigation when their meaning is recognizable in context. Preserve labels for settings, ambiguous actions or choices, measurements, and essential status. A tooltip supplements understanding; it does not carry the only explanation required to complete a task.

Standardize tooltips on the shared Radix implementation, with the existing 300ms delay as the starting behavior. Show them on hover and keyboard focus; dismiss predictably on Escape or loss of hover/focus. Avoid duplicate native `title` tooltips. Tooltips contain short, noninteractive explanations. Interactive or rich content belongs in a popover, disclosure, or modal with explicit activation.

On touch devices, controls must remain understandable and usable without hover. Where an icon is ambiguous, provide a visible label or an explicit information control that opens a dismissible explanation. Preserve ordinary single-tap action behavior.

## Information hierarchy and disclosure

Use one shared disclosure pattern with a clear affordance, accessible section name, and exposed expanded/collapsed state. Supporting details are one deliberate activation away. Label the disclosure when needed for understanding; an icon preference does not justify an ambiguous expansion control.

### Attempt detail structure

Solve and Cross results share this structure wherever their content supports it:

1. Result header with the primary outcome and relevant attempt context.
2. Primary metrics in a consistent metric group.
3. Phase or move analysis appropriate to the training mode.
4. Supporting details in named expandable sections.
5. Consistently positioned result actions.

For solves, immediately show total time, phase timeline, recognition/execution breakdown, turns, and TPS. Keep the useful phase table visible. Put cumulative times and additional metadata under Details. Avoid duplicating the same summary in several places; show units and explain abbreviations where needed.

For Cross, immediately show the outcome and relevant available move/time measurements. Where optimal and executed move counts are available, present their difference coherently in the same metric pattern. Preserve useful scramble, move, and case information in the appropriate visible analysis or supporting section. Do not invent unavailable metrics or fabricate zeroes.

Rich phase and case details remain accessible by explicit activation on keyboard and touch. Any hover preview is supplementary to that interaction.

## Modal conventions

Extend `Overlay` as the common modal shell. It owns accessible title, consistent header and close position, focus containment and restoration, viewport bounds, scrolling, and dismissal behavior.

- Provide explicit small, medium, and wide size variants selected by the caller. Start with approximate maximum widths of 480, 640, and 1040px; validate them against content.
- Use standard section spacing and a shared footer/action area when actions are present.
- Place the main action consistently at the end of the action group. Keep destructive actions visually distinct and separated from routine actions.
- Keep the close control predictable and reachable. Content scrolls within the viewport; narrow layouts must preserve access to header and actions.
- Preserve Escape and backdrop dismissal for ordinary dialogs. Document any exception for an active operation or unsaved state, including its alternative exit path.
- Choose size through component props rather than CSS inspecting descendants.

Settings use the same section and field patterns as other forms. Solve and Cross details use the common attempt structure. Device, Import shared scramble, and New session use the same modal and action conventions with content-specific fields.

## Component structure

Extend the current React, Radix-based primitives, and Lucide foundation. Names below describe responsibilities; proposed components are targets, not claims that matching exports already exist.

| Layer | Existing foundation | Target responsibility |
| --- | --- | --- |
| Controls | Button, IconButton, Tooltip, Dialog, Tabs, NativeSelect, Table | Accessible interaction, variants, dimensions, focus, and disabled states. |
| Shared patterns | Overlay and existing repeated layouts | Modal sections/footer, section, field row, metric group, disclosure, action bar, and data table conventions. |
| Domain components | CubeView, guidance, SessionPicker, HistoryTable, SolveScramble, CFOPBreakdown | Cube-specific rendering and interactions using shared patterns. |
| Screens | Solve, Cross Trainer, Insights, Debug | Compose domain components and shared patterns; own feature state and workflow. |

Refine `Overlay` and `IconButton` before introducing competing wrappers. Extract shared patterns from repeated real layouts. An attempt summary can compose header, metrics, analysis, details, and actions without forcing both training modes to supply identical fields.

Shared components own spacing, semantics, and interaction contracts. Domain components own cube terminology and domain-specific presentation. Screens supply data and callbacks. Prefer explicit variants and composition slots over feature-name conditionals, descendant selectors, and arbitrary style overrides.

Use the existing `src/components/ui` location for primitives, `src/components` for shared patterns, and `src/features` for feature-specific compositions. A component should expose the smallest API that supports its actual callers. Document intentional visual or behavioral exceptions with their reason and scope.

## Interaction states

| State | Shared behavior |
| --- | --- |
| Hover | Subtle surface or border change without moving content. |
| Keyboard focus | Clearly visible focus ring with adequate contrast; accessible activation and logical focus order. |
| Selected/expanded | Persistent marker and programmatic state such as `aria-current`, `aria-pressed`, or `aria-expanded`, as appropriate. |
| Disabled | Recognizably unavailable; explain the reason visibly or through an accessible adjacent explanation when necessary. |
| Loading | Keep layout stable, show progress near the initiating action, and prevent duplicate submission. |
| Empty | Briefly identify what is missing and provide a relevant next action where available. |
| Error | Explain the problem near its source and provide an actionable recovery path; preserve useful input. |
| Success | Give concise feedback near the action, including accessible announcements when appropriate. |

Use the same feedback pattern for equivalent actions, such as copying a scramble across views. Avoid tooltip-only errors, icon-only ambiguous status, or color-only feedback.

## Responsive behavior

Reflow summaries, fields, and action groups on narrow screens. Keep values, labels, and controls readable. Dense analysis tables may scroll horizontally inside a bounded, discoverable scroll area; the page itself should fit the viewport. Preserve row and column context where practical.

Modal width is bounded by the viewport with consistent outer spacing. Keep important controls usable with touch and keyboard. Validate both mobile and desktop layouts, browser zoom, long labels, long scrambles, and overflowing content.

## Adoption checklist

Implement incrementally, starting with foundations and shared patterns. Each migrated screen must use those patterns before adding local exceptions.

- [ ] Foundations: implement typography and spacing tokens; verify contrast, control dimensions, and numeric alignment.
- [ ] Shared controls: unify icons, tooltips, focus, selection, and feedback behavior.
- [ ] Shared layouts: extend Overlay and introduce the needed section, field, metric, disclosure, and action patterns.
- [ ] Solve: align training controls, timer, scramble, history, and guidance with the shared system.
- [ ] Solve details: preserve immediately visible analysis; standardize metrics, case details, supporting information, and actions.
- [ ] Cross Trainer: reuse training, history, and control patterns while preserving its specific workflow.
- [ ] Cross details: adopt the common attempt structure wherever appropriate.
- [ ] Settings: unify fields, sections, disclosure behavior, and modal sizing.
- [ ] Device: unify connection controls, state feedback, and modal layout.
- [ ] Import shared scramble: unify fields, validation, and actions.
- [ ] New session: unify fields, validation, and actions.
- [ ] Insights: apply shared navigation, tabs, surfaces, and placeholder states without adding analytics features.
- [ ] Debug: use shared controls and sections; retain appropriately dense technical details and bounded overflow.

### Completion criteria for a migrated view

Verify the view visually on desktop and mobile. Confirm keyboard navigation, accessible control names, focus restoration for modals, tooltip/disclosure behavior, and touch usability. Exercise applicable empty, loading, disabled, and error states. Check that essential information remains visible and supporting detail remains reachable.

Compare it with at least one other view using the same patterns: equivalent controls, section spacing, actions, and metrics should behave and align consistently. Record any intentional exception in this guide. Run relevant existing checks for behavior changed during implementation; this documentation-only planning step requires no application changes.
