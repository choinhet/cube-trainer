# Cube Trainer

A browser app for practicing full solves and efficient crosses with a GAN smart
cube. Physical turns update a live 3D cube, drive scramble guidance, and start
and stop timing automatically. Sessions and results are saved locally in your
browser.

## Features

### Solve

- Automatically prepares a new scramble from your cube's current synchronized
  state, with step-by-step setup and correction guidance.
- Starts timing on the first solve turn and stops when the cube is solved.
- Shows a compact Cross, F2L, OLL, and PLL timing breakdown after supported
  CFOP solves and in saved history. Select or focus a phase for details; exact
  durations also appear as text. Phase totals use raw time, excluding inspection
  and penalties. Saved physical traces reproduce the breakdown offline.
- F2L stays grouped in the bar; expand its four pairs to review recognition and
  execution. Darker sections show recognition and lighter sections execution.

See [CFOP timing and offline analysis](docs/cfop-analysis.md) for the timing model,
supported case identification, and saved-history behavior.
- Offers optional 15-second inspection, with a +2 penalty until 17 seconds and
  DNF after that.
- Saves results automatically and advances to the next scramble. Abandoning an
  active solve records a DNF; cancelling setup creates no solve result.
- Shows saved times and turns per second (TPS). Open a result to review its
  session, date, status, and raw time, toggle +2 or DNF, or delete it.

### Cross Trainer

Practice any of the six cross colors at difficulties from **1 to 8 optimal
moves**. Each generated case scrambles the whole cube and guides you to its
starting position from your current cube state.

| Mode             | How it works                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Free**         | Solve the cross your own way, with a timer and executed move count. Reveal an optimal solution when you want help. |
| **Semi-guided**  | Find an optimal route with the algorithm hidden. Mistakes show undo guidance.                                      |
| **Fully-guided** | Follow a displayed optimal solution. The continuation adapts when you choose another optimal route.                |

Both guided modes accept every optimal route. Compare your executed move count
with the optimum, retry the same case, or move to the next one. You can switch
modes during an attempt; history records these attempts as Mixed and remembers
whether a solution was displayed or revealed.

Copy a case's shareable scramble, or use **Import shared scramble** to paste
face turn notation such as `R U2 F'` and choose a cross color. Imported
scrambles use white on top and green in front; their difficulty is calculated
automatically. The app adapts setup to your connected cube's current position.

Cross history is separate from full solve history and includes the case, mode,
completion status, executed moves, optimum, and assistance status. Free attempts
also show time and TPS. See [Cross Trainer details](docs/cross-trainer.md) for
mode switching, move counting, and instruction orientation.

### Live cube and preferences

- View physical turns and gyro orientation on an interactive 3D cube. Drag to
  orbit the camera, or use arrow keys while the viewer is focused.
- Enable **Locked 3D mode** in Settings to keep a fixed 24-degree downward
  tilt while physical rotations animate between all 24 cube orientations.
  Small gyro movements stay still. **Default angle (degrees)** adjusts front/right
  visibility from 5 to 85 degrees (25 by default); valid edits apply immediately.
  Both preferences are saved locally and apply to Solve and Cross Trainer.
- In locked mode, each arrow press or deliberate drag turns the view by one
  quarter-turn. Hold/repeat, clicks, and small drags add no extra rotations.
  Manual viewing adjustments survive gyro updates; **Reset gyro (U4)** or
  reconnecting clears them. Disable locked mode to restore continuous viewing.
- Open the connected cube's **Device** panel to check its battery, disconnect,
  reset the gyro, or confirm a physically solved cube for state synchronization.
- Create and select named practice sessions with the **Session** picker. A
  **Default** session is available on first use.
- Use **Settings** to enable inspection, show face labels, or display cross
  instructions with the selected cross on the bottom. Related settings are in
  collapsible sections, open by default. The interactive **3D cube preview**
  shows angle, face-label, and viewing-mode changes inside Settings.
- Enable **Debug** for connection and state diagnostics, downloadable viewer
  traces, and an exact cross case inspector.

**Insights** currently provides access to saved solve results and their details.
Progress graphs, averages, and milestones are not available yet.

## Run locally

Use Node.js 24 and npm. Cube connection requires Bluetooth and a browser with
Web Bluetooth support; use Chrome or Edge on Windows. GAN16 UI connection and
live viewing have been verified in Windows Chrome. Other device/browser
combinations may vary.

```sh
npm ci
npm run dev
```

Open [Cube Trainer locally](http://127.0.0.1:5173/), keep your cube awake, and
click **Connect Cube**. Select it in the browser's Bluetooth chooser. If
prompted, enter the cube's Bluetooth MAC address from the GAN app or device
label; it is remembered for that device. Localhost supports Web Bluetooth;
hosted copies require HTTPS.

Once the cube is synchronized, practice prepares automatically. Follow the setup
moves until **You may start** appears, then begin solving. Setup moves use white
on top and green in front. Cross guidance includes holding instructions for your
chosen cross color.

If the app cannot establish the cube state, physically solve every face, open
**Device**, choose **Reset cube state (D4)**, and confirm that the cube is
solved.

## Local data and timing

Sessions, preferences, and practice history are stored in IndexedDB for this
browser profile and site address. Clearing browser data can remove them. There
is no account, cloud sync, history export/import, or backup facility. Shared
scramble import is available in the Cross Trainer.

The app attempts to recover tracking after missed Bluetooth events. Reconnecting
can restore tracking while a solve timer continues running. Reopening the
browser records unfinished saved checkpoints as interrupted attempts. If a
result cannot be saved, the app shows an error and a retry action. Use one
practice page for an active attempt.

Timing uses the browser's receipt of cube events, so Bluetooth latency and event
batching can affect measured times.

## Project commands

The app uses React, TypeScript, and Vite and runs entirely in the browser.

```sh
npm run build         # Type-check and build production assets
npm test              # Unit and component tests
npm run typecheck     # TypeScript checks
npm run lint          # ESLint checks
npm run test:browser  # Build and run browser integration tests
```

Browser integration tests use installed Windows Chrome.
