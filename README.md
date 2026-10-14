# Cube Trainer

A browser-only React/TypeScript application for inspecting a connected GAN cube,
practicing timed solves, and learning efficient crosses. GAN16 UI is validated in
Windows Chrome for connection and live viewing. GAN i4, Edge, and integrated
physical practice acceptance remain assigned to issue 017.

## Run

Requirements: Node.js 24 and npm, Windows Chrome or Edge, Bluetooth enabled.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173/. Localhost is a secure context for Web Bluetooth;
hosted copies require HTTPS. Click **Connect cube** to open the chooser. A
cancelled chooser or denied permission permits retry. Only one connection is
allowed, including while the preceding connection is being torn down.

A validated device report establishes initial synchronization. Unknown state
stays unknown. If a report is unavailable, physically solve the cube, choose
**Device**, then **Reset cube state (D4)**, and explicitly confirm. A conflicting unsolved report
cannot be overwritten. With no serial available, the first live move establishes
the event baseline; loss before that baseline cannot be detected.

Drag the 3D cube to orbit the camera; hold arrow keys while focused to orbit
continuously. Gyro orientation remains separate from camera and logical state.
White is U, yellow D, red R, orange L, green F, and blue B. Center letters define
notation. Each accepted physical quarter turn updates the cube immediately.
Tracking recovery requests fresh device state automatically. Recovered turns and
connection loss preserve an armed attempt and its running timer; reconnecting
restores tracking without manual synchronization.

A persistent **Default** session is ready on first use. Use the compact Session picker to select sessions and **New session** to create one in a dialog. Practice scrambles prepare automatically after connecting and after **Next scramble**. Follow
the full executable move sequence to its full target from the current synchronized
state. Setup mistakes show undo guidance. Optional inspection starts at target
arrival; the next physical turn starts solve timing and solved state stops it.
Results retain raw duration separately from inspection penalties and save locally. Before the first turn, cancellation creates no result; active abandonment saves DNF. Recovered Bluetooth turns retain their recovery flags and hardware timestamps in the saved trace and use host receipt time for timing. Browser reopening recovers unfinished checkpoints as interrupted records. Failed writes stay visible and retryable. Use one practice page for an active attempt.
See [timing details](docs/timed-results.md) and [recovery behavior](docs/interruption-recovery.md).

Cross practice generates a full-cube scramble with the selected cross difficulty; the scramble does not expose a minimal cross solution. Choose **Free**, **Semi-guided**, or **Fully-guided**. Guided modes accept every optimal route and show undo guidance after mistakes. Fully-guided mode keeps completed moves visible and switches the displayed continuation when you choose an alternative optimal route. Completed cases stay available for **Retry same case**, **Next case**, and, in Free mode, **Reveal cross solution**. See [cross trainer behavior](docs/cross-trainer.md).

The **Exact cross case inspector** offers all six colors and exact difficulties
1–8. It shows full targets, every optimal next move, and a display continuation.
The inspector itself does not record practice attempts. See
[solver validation and measured performance](docs/cross-solver.md).

Sessions, settings, and completed results belong to this browser profile and
site origin in IndexedDB. Clearing browser data can remove them. There is no
account, application backend, export/import, or backup.

Enable **Debug** in **Settings**, then open **Viewer traces** to download viewer traces before
reloading. Viewer traces remain in memory. Elapsed timing uses host
`performance.now()` receipt time with uncompensated Bluetooth latency/batching;
it is not a calibrated hardware-precision guarantee.

## Diagnostic and physical acceptance

The diagnostic is available on **Debug** after enabling it in **Settings**.
Use [the diagnostic procedure](docs/device-diagnostic.md) and
[the viewer checklist](docs/live-viewer.md). Synthetic events and browser tests
verify software behavior; hardware acceptance requires physical observations.

## Verification

```sh
npm test
npm run typecheck
npm run lint
npm run test:browser
```

The browser command builds production assets and runs installed Windows Chrome
integration checks against development and production origins. Unit tests cover
cube validity, event integrity, guidance, lifecycle, storage, and exact cross
search. CSS perspective/3D transforms render the cube. Dependencies are pinned in
package.json and package-lock.json.

## Workspace design

See [design tokens and controls](docs/design-system.md), [source responsibilities](docs/source-boundaries.md), and [actual screen review](docs/design-review/README.md). Issue 022 has a separate human visual acceptance gate; screenshots and passing tests do not establish approval.
