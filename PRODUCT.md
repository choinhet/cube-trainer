# Cube Trainer

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Speedcubers practicing full solves and efficient crosses on a physical GAN smart cube, primarily using desktop Chrome or Edge. No particular skill level has been selected as the priority.

## Product Purpose

Make deliberate physical-cube practice easier to run and review. Physical turns drive setup guidance, automatic timing, live cube visualization, and saved results. Cross practice helps users compare their performed moves with the exact optimum; full-solve analysis helps users understand phase, recognition, and execution time.

## Positioning

The central mechanism is a training loop connected to the physical cube: prepare from its current synchronized state, follow actual turns, detect completion, and review the attempt. Guided cross practice accepts every optimal route rather than requiring one displayed algorithm.

## Operating Context

- Cube connection requires Bluetooth and a browser supporting Web Bluetooth. GAN16 UI connection and live viewing have been verified in Windows Chrome; other combinations are not guaranteed.
- Local development uses Node.js 24, npm, and `npm run dev` at `http://127.0.0.1:5173/`. Hosted copies require HTTPS for Web Bluetooth.
- Users connect and synchronize their cube, select a named session, and practice Solve or Cross Trainer. Setup adapts to the current cube position.
- Shared scrambles use white on top and green in front. Bottom-cross instructions are proper cube rotations, with explicit holding guidance.
- Sessions, preferences, and history belong to the current browser profile and site address. Use one practice page for an active attempt.

## Capabilities and Constraints

- Solve prepares scrambles automatically, starts timing on the first solve turn, detects completion, saves results, and advances. Optional inspection applies +2 after 15 seconds and DNF after 17 seconds. Saved results support penalty edits and deletion.
- Supported CFOP solves expose Cross, F2L, OLL, and PLL timing, including recognition and execution details where available. Raw timing excludes inspection and penalties. Saved physical traces support offline analysis; unsupported evidence must show that detailed timing is unavailable rather than fabricate it.
- Cross Trainer supports all six cross colors, exact difficulties from 1 to 8 optimal moves, and Free, Semi-guided, and Fully-guided modes. Difficulty counts quarter turns and half turns as one move each; it is not scramble length.
- Guided modes accept every compatible optimal solution. Correction restores the exact full-cube state at the last valid prefix. Executed move count includes mistakes and correction activity rather than cancelling inverse turns.
- Users can reveal a solution, retry the same cross case, advance to another case, or share/import a scramble. Mode changes preserve the attempt; history records Mixed mode and assistance honestly.
- Live 3D viewing supports physical turns, gyro orientation, manual camera adjustment, face labels, and an optional locked viewing mode. Device controls support battery inspection, disconnection, gyro reset, and confirmed solved-state synchronization.
- IndexedDB stores data locally. There are currently no accounts, cloud synchronization, history export/import, or backup facilities. Cross shared-scramble import is a separate supported capability. Clearing browser data can remove history.
- Insights currently exposes saved solve results and details; graphs, averages, and milestones are not implemented.
- Bluetooth latency and event batching affect measured timing. Recovery and persistence failures need understandable status and recovery actions.
- Debug provides connection/state diagnostics, viewer traces, and a cross case inspector.

## Brand Commitments

The product name is Cube Trainer. Use English for generated documentation and interface copy unless explicitly requested otherwise.

The user confirmed on 2026-10-15 that the existing design document did not produce a satisfactory-looking website and may be changed as needed in future design work. Its palette, typography, icon preferences, dimensions, and layout rules are revisable, rather than binding product commitments. This initialization does not choose a replacement visual direction.

## Evidence on Hand

- `README.md`: current capabilities, operating requirements, local storage limitations, and development commands.
- `GLOSSARY.md`: authoritative cross-training terminology.
- `docs/cross-trainer.md`: mode behavior, optimal paths, physical move counting, correction, sharing, and repeated attempts.
- `docs/cfop-analysis.md`: timing semantics, supported analysis, catalog identification, and offline reconstruction.
- `docs/design-system.md` and `docs/design-system-adoption.md`: incumbent design and implementation history, including earlier user feedback. Consult them as historical evidence; visual prescriptions may be revised under the user's direction.
- Existing React/TypeScript implementation, unit/component tests, and browser integration tests provide behavioral evidence. Automated Bluetooth harnesses do not establish physical hardware compatibility.

## Product Principles

- Let physical turns drive the practice loop and minimize manual bookkeeping.
- Preserve exact cube-state and optimal-route semantics while improving presentation.
- Make results interpretable: distinguish time, move counts, penalties, assistance, and unavailable analysis.
- Preserve locally saved practice data and make failures recoverable.
- Improve visual quality without silently changing training behavior or claiming unimplemented capabilities.

## Accessibility & Inclusion

Existing documented requirements include keyboard access, accessible control names and states, visible focus, modal focus containment/restoration, readable contrast, touch usability, and feedback that does not depend on color or hover alone. Preserve these usability requirements when revising visual design. No additional audience-specific accessibility needs were identified during initialization.

## Open Decisions

- Priority skill level and more specific practice situations.
- Future accounts, synchronization, backup, and expanded analytics; these are not current capabilities or committed roadmap items.
