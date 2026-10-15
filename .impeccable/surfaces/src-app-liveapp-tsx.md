---
version: 1
slug: "src-app-liveapp-tsx"
primary_target: "src/app/LiveApp.tsx"
related_targets: ["src/styles/workspace.css","src/features/cross/FreeCrossPractice.tsx"]
---

# Cube Trainer redesign brief

Status: Approved for implementation by the user's "JUST DO IT" instruction.

## Job and audience

Redesign the whole existing browser app, implementing Solve first. The audience is speedcubers practicing with a physical GAN smart cube on desktop Chrome or Edge. This is an Operate surface: users glance between the physical cube and the screen and need to understand the current practice state immediately.

The primary visual focus is the live cube and timer. Analysis must be easy to reach without competing with active practice. Success means a minimalist, colorful, intuitive interface with consistent spacing, deliberate centering, fewer containers, and less repetitive text.

## Outcome and product truth

Preserve the physical-turn-driven loop: connect and synchronize, prepare from the current cube state, follow setup, start timing on the first solve turn, detect completion, save, and advance. The redesign changes presentation, not these transitions.

Use actual results and phase timing as evidence. Cross training retains exact difficulty, every optimal route, full-state correction, repeat attempts, mode changes, and honest assistance tracking. Preserve local data and the measurement definitions documented in PRODUCT.md, GLOSSARY.md, and the feature documents.

## Selected direction: Competition Stage

The user selected Competition Stage on 2026-10-15. The decision page recorded `optionId: assigned`, `buildPath: code`, and no workflow flip. The approved planning reference is `.impeccable/mocks/decision/assigned.html`. It is a composition sketch, not a production implementation or a generated-image comp. No approved raster comp exists.

- **Visual authority:** replace the incumbent boxed dashboard presentation with a midnight-indigo shell, pale-blue practice ground, electric-blue selection, and restrained coral, mint, and amber for meaningful data or states. The sketch anchors are indigo `#172554`, pale blue `#eff6ff`, blue `#2563eb`, coral `#fb7185`, and mint `#34d399`. Final accessible tokens and type choices belong to implementation, within this selected character.
- **First viewport:** a compact top navigation contains product identity, destinations, Device, and Settings. A light utility row contains the page name and session selection. The main canvas contains setup notation and one concise state message, the centered live cube, and the timer on a shared centerline. A proportional phase ribbon and a clear analysis action sit below; a shallow recent-attempt row follows.
- **Signature:** the completed result's continuous phase ribbon connects directly to phase details. Keep the ribbon proportional to recorded duration. Its colors retain the same meaning in live results and saved details. Hover is supplementary; click, keyboard, and touch provide equivalent access.
- **Sequence:** practice state leads, the cube and timer dominate, phase review follows, and history supports the session. No unequal flanking sidebars displace the practice centerline.
- **System discipline:** one content plane instead of nested panels; stable numeric columns; updates affect relevant information without moving surrounding content; metrics stay near their supporting details; meaningful color roles remain consistent throughout the app.
- **Risk:** strong shell color and phase colors must not compete with physical sticker colors or make errors difficult to distinguish. Color is paired with labels or other accessible state cues.

## Scope and boundaries

Deliver a production-ready presentation across Solve, Cross Trainer, Insights, Settings, Device, session creation, shared-scramble import, result details, and optional Debug. Solve establishes the reusable system first; the other surfaces inherit it while preserving their distinct jobs.

Existing `docs/design-system.md` visual prescriptions may change as needed under the user's explicit authorization. Its earlier behavioral and accessibility evidence remains relevant. Do not merely recolor the old panels. Do not create DESIGN.md, a direction contract, implementation tickets, or application changes as part of shape; those follow a confirmed brief and a build request.

No new analytics, averages, milestones, accounts, cloud synchronization, backup, hardware claims, or other product capabilities. Illustrative values in sketches are not application defaults or saved user data. Replace the sketch's flat cube placeholder with the existing interactive 3D viewer during implementation.

## States and content ranges

- Support first use, disconnected/connecting/connected, unsupported Bluetooth, synchronization required, loading, setup and correction, ready, inspection, active timing, completed, abandoned/interrupted, saving, save failure/retry, and unavailable detailed timing.
- Keep the cube/timer placement stable across practice states. Setup and errors must remain visible and actionable without duplicated status paragraphs.
- History must work with zero, one, and many attempts. The sketch's short recent row is a preview, not permission to lose access to full history, pagination, or result actions.
- Account for short and long session names, long scramble strings, all six cross colors, difficulties 1–8, mode changes, penalties, DNF, skipped phases, unrecognized algorithms, and missing analysis. Never fabricate zero values for unavailable measurements.
- Preserve full CFOP and F2L-pair details without forcing all of them into the practice viewport. Expanded details must not obscure active controls or change the timer's position unexpectedly.

## Interaction and layout

Use spacing, alignment, and typography to group content before adding borders or surfaces. Center the practice presentation as a deliberate composition; keep descriptive labels and dense tables aligned for reading rather than centering every element indiscriminately.

Keep familiar web navigation, buttons, selects, disclosures, and dialogs. Use visible text when needed to understand an action; icon-only controls require accessible names and appropriate explanations. Remove repeated prose, not necessary units, notation, holding instructions, recovery guidance, or ambiguous labels.

The analysis action is available after a result. Phase activation reveals associated details without hover-driven reflow. Preserve convenient saved-result review and penalty/delete actions. Keep the existing automatic preparation and cancellation semantics.

On narrow screens, retain the hierarchy: essential navigation and connection/session access, setup and state, cube/timer, analysis, then history. Reflow controls and tables without shrinking text or creating page-wide horizontal scrolling. Layout must also tolerate browser zoom, long content, and reduced motion. Avoid decorative motion during timing; completion feedback may be concise and localized.

## Constraints and decisions for implementation

- Existing React, TypeScript, Vite, Radix, Lucide, worker, Bluetooth, and IndexedDB foundations remain the implementation context.
- Preserve keyboard access, visible focus, readable contrast, accessible states, modal focus behavior, touch usability, and non-color-only feedback.
- Build code-first against the selected sketch. Establish shared spacing, typography, color, and control tokens before migrating the remaining screens. Record the finished system and reconcile superseded design documentation during implementation, not during this planning step.
- Verify current desktop and narrow layouts and actual practice states during implementation; the historical screenshot reviewed during discovery is not fresh verification.
- Open implementation choices: exact typeface, final accessible token values, narrow-screen navigation treatment, and history expansion placement. Resolve them within the selected composition and existing behavior; a material departure from the selected direction requires user input.

## Confirmation

Confirm this brief or provide one correction round. Shape stops here without implementing the redesign.

## Direction contract

THESIS: Physical practice takes the stage: one centered cube and timer, with result analysis below, replacing the boxed three-column dashboard.

OWN-WORLD: Midnight-indigo navigation over a pale-blue canvas, electric-blue controls, coral/mint/amber phase data, open sans typography, flat content regions, and a shared spacing scale.

STORY: Connect, select a session, follow setup, solve, then inspect the phase ribbon or a recent attempt. Product semantics and saved data remain intact.

FIRST VIEWPORT: Full-width compact navigation and Device/Settings above a utility row with page title and session. Center cube and large tabular timer on the canvas. A proportional ribbon opens analysis; recent results form one shallow row below. Cross controls sit above its practice stage.

FORM: Competition Stage, grounded candidate 6, seed 92915e66. The selected HTML sketch is the composition reference; code-first, no approved raster comp. Signature: direct selection of the continuous colored phase ribbon with accessible phase details.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
