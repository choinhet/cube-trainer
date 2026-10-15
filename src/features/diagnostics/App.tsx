import { Button } from "../../components/ui/button";
import { useReducer, useState } from "react";
import { DiagnosticSession, type Connection } from "../../domain/session";
import { DiagnosticText } from "./DiagnosticText";
import { FACES } from "../../domain/cube";
import { measureTiming } from "../../domain/timing";

interface Props {
  connectCube?: () => Promise<Connection>;
  bluetoothAvailable?: boolean;
  sharedSession?: DiagnosticSession;
}
export function App({
  sharedSession,
  connectCube = async () => {
    throw new Error("Bluetooth connector unavailable");
  },
  bluetoothAvailable = window.isSecureContext && !!navigator.bluetooth,
}: Props) {
  const [, redraw] = useReducer((value: number) => value + 1, 0);
  const [session] = useState(
    () =>
      sharedSession ??
      new DiagnosticSession(connectCube, () => performance.now(), redraw),
  );
  const [model, setModel] = useState("GAN16 UI");
  const [firmware, setFirmware] = useState("");
  const [browserVersion, setBrowserVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [phase, setPhase] = useState("Connection / cancellation / retry");
  const [annotations, setAnnotations] = useState<
    { hostMs: number; phase: string; notes: string }[]
  >([]);
  const [eventPage, setEventPage] = useState(0);
  const [uiError, setUiError] = useState<string | null>(null);
  const snapshot = session.diagnostic.snapshot();
  const trace = session.diagnostic.trace();
  const timing = measureTiming(trace);
  const connected = session.status === "connected";
  const reportedState = snapshot.candidate?.facelets;
  const hardware = [...trace]
    .reverse()
    .find((entry) => entry.event.type === "HARDWARE")?.event;
  function capture(): void {
    const report = {
      schemaVersion: 1,
      candidatePackage: "gan-web-bluetooth@3.0.2",
      capturedAt: new Date().toISOString(),
      browserUserAgent: navigator.userAgent,
      secureContext: window.isSecureContext,
      model,
      testerReportedFirmware: firmware || "unknown",
      testerReportedBrowserVersion: browserVersion || "unknown",
      deviceName: session.deviceName,
      timingBasis:
        "performance.now() at adapter receipt; Bluetooth latency/batching not compensated",
      hardwareAcceptance:
        "unvalidated: requires physical evidence for both models and browsers",
      phase,
      notes,
      annotations,
      snapshot,
      timing,
      currentTrace: trace,
      previousRuns: session.previousRuns,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `gan-diagnostic-${model.replaceAll(" ", "-")}-${Date.now()}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function confirm(): void {
    try {
      session.diagnostic.confirmState();
      setUiError(null);
      redraw();
    } catch (error) {
      setUiError(String(error));
    }
  }
  return (
    <div className="diagnostic-content">
      <header>
        <p className="eyebrow">CUBE TRAINER · HARDWARE FEASIBILITY</p>
        <h1>GAN device diagnostic</h1>
        <p>
          Observe physical behavior before trusting an adapter. Neither required
          model is validated yet.
        </p>
      </header>
      {!bluetoothAvailable && (
        <p role="alert">
          Use Windows Chrome or Edge in a secure context: HTTPS or
          http://127.0.0.1:5173. Web Bluetooth is unavailable here.
        </p>
      )}
      <section aria-labelledby="connection-title">
        <h2 id="connection-title">1. Connect and identify</h2>
        <div className="fields">
          <label>
            Physical model
            <select
              value={model}
              disabled={trace.length > 0 || session.status !== "disconnected"}
              onChange={(event) => setModel(event.target.value)}
            >
              <option>GAN16 UI</option>
              <option>GAN i4</option>
            </select>
          </label>
          <label>
            Firmware version
            <input
              value={firmware}
              onChange={(event) => setFirmware(event.target.value)}
              placeholder="Record from hardware response or GAN app"
            />
          </label>
          <label>
            Exact browser version
            <input
              value={browserVersion}
              onChange={(event) => setBrowserVersion(event.target.value)}
              placeholder="From Chrome / Edge About page"
            />
          </label>
        </div>
        <div className="buttons">
          <Button variant="outline"
            disabled={!bluetoothAvailable || session.status !== "disconnected"}
            onClick={() => void session.connect()}
          >
            Connect cube
          </Button>
          <Button variant="outline"
            disabled={!connected}
            onClick={() => void session.disconnect()}
          >
            Disconnect
          </Button>
          <Button variant="outline"
            disabled={!connected}
            onClick={() => void session.request("REQUEST_HARDWARE")}
          >
            Request hardware
          </Button>
          <Button variant="outline"
            disabled={!connected}
            onClick={() => void session.request("REQUEST_BATTERY")}
          >
            Request battery
          </Button>
        </div>
        <p role="status">
          Connection: <strong>{session.status}</strong> ·{" "}
          <span>{session.deviceName ?? "No device selected"}</span>
        </p>
        {(session.error || uiError) && (
          <p role="alert">{session.error || uiError}</p>
        )}
        <details>
          <summary>Browser and reported hardware</summary>
          <p>{navigator.userAgent}</p>
          <DiagnosticText
            label="hardware lines"
            text={
              hardware
                ? JSON.stringify(hardware, null, 2)
                : "No hardware response observed. Requesting a capability does not prove support."
            }
          />
        </details>
      </section>
      <section aria-labelledby="state-title">
        <h2 id="state-title">2. Check state and physical face mapping</h2>
        <p>
          Keep the cube still, request its state, and compare every sticker with
          the net below. Confirm only after checking the physical cube. Face
          letters use the device’s fixed center reference.
        </p>
        <div className="buttons">
          <Button variant="outline"
            disabled={!connected}
            onClick={() => void session.request("REQUEST_FACELETS")}
          >
            Request state
          </Button>
          <Button variant="outline" disabled={!connected || !reportedState} onClick={confirm}>
            Confirm reported state matches physical cube
          </Button>
        </div>
        <p>
          Tracking: <strong>{snapshot.tracking}</strong>
          {snapshot.reason ? ` — ${snapshot.reason}` : ""}
        </p>
        <div className="cube-net" aria-label="Reported or tracked cube state">
          {[...FACES].map((face, i) => (
            <div className={`face face-${face}`} key={face}>
              <span>{face}</span>
              <div className="stickers">
                {[
                  ...(
                    reportedState ??
                    snapshot.facelets ??
                    "?".repeat(54)
                  ).slice(i * 9, i * 9 + 9),
                ].map((sticker, j) => (
                  <span className={`sticker color-${sticker}`} key={j}>
                    {sticker}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p>
          {reportedState
            ? "Fresh device report awaiting confirmation / comparison."
            : "Tracked prediction. Request a fresh state after the test sequence to compare it."}
        </p>
        <p>
          Observed event types: state{" "}
          {snapshot.observed.state ? "yes" : "unobserved"}, moves{" "}
          {snapshot.observed.moves ? "yes" : "unobserved"}, gyro{" "}
          {snapshot.observed.gyro ? "yes" : "unobserved"}. Observation alone is
          not hardware validation.
        </p>
        <p>
          Physical gyro quaternion:{" "}
          <code>
            {snapshot.orientation
              ? JSON.stringify(snapshot.orientation)
              : "unobserved"}
          </code>
        </p>
        <p>
          Rotate the whole cube without turning faces: quaternion should change,
          logical state should stay fixed. Then turn the same marked face in
          several poses and record the logical face reported. No camera-derived
          remapping is used.
        </p>
      </section>
      <section aria-labelledby="evidence-title">
        <h2 id="evidence-title">3. Record test evidence</h2>
        <label>
          Test phase
          <select
            value={phase}
            onChange={(event) => setPhase(event.target.value)}
          >
            {[
              "Connection / cancellation / retry",
              "State and single-face turns",
              "Gyro and whole-cube rotation",
              "Slice / wide actions and split half turns",
              "Rapid turns and timing comparison",
              "Disconnect / recovery / inconsistent state",
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Physical actions, expected behavior, actual result, and limitations
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Example: red center marked; R after x rotation still reported R. Pass/fail and evidence reference."
          />
        </label>
        <div className="buttons">
          <Button variant="outline"
            onClick={() =>
              setAnnotations((previous) => [
                ...previous,
                { hostMs: performance.now(), phase, notes },
              ])
            }
          >
            Add timestamped observation
          </Button>
          <Button variant="outline" onClick={capture}>Download diagnostic trace</Button>
        </div>
        <p role="status">
          {annotations.length} observations · {trace.length} events this run ·{" "}
          {session.previousRuns.length} previous runs retained in memory.
          Download before closing or reloading.
        </p>
        <p>
          Host timing basis: <code>performance.now()</code> at receipt.
          Bluetooth delay and batching affect accuracy; recovered events cannot
          establish live timing. Device clock remains uncalibrated.
        </p>
        <p>
          {timing.moveCount} physical move reports · {timing.recoveredCount}{" "}
          recovered · host first-to-last move span{" "}
          {timing.hostSpanMs === null
            ? "unavailable"
            : `${timing.hostSpanMs.toFixed(2)} ms`}
        </p>
        {!sharedSession && (
          <details>
            <summary>Clock interval comparison (last 20 pairs)</summary>
            <pre>{JSON.stringify(timing.intervals.slice(-20), null, 2)}</pre>
          </details>
        )}
        {sharedSession ? (
          <div>
            <div className="buttons">
              <Button variant="outline"
                disabled={eventPage === 0}
                onClick={() => setEventPage(eventPage - 1)}
              >
                Previous event
              </Button>
              <span>
                Event {Math.min(eventPage + 1, trace.length)} / {trace.length}
              </span>
              <Button variant="outline"
                disabled={eventPage + 1 >= trace.length}
                onClick={() => setEventPage(eventPage + 1)}
              >
                Next event
              </Button>
            </div>
            <DiagnosticText
              label="event lines"
              text={JSON.stringify(
                trace[Math.min(eventPage, trace.length - 1)] ?? "No events",
                null,
                2,
              )}
            />
          </div>
        ) : (
          <details>
            <summary>
              Recent raw events (last 12; download contains all)
            </summary>
            <pre>{JSON.stringify(trace.slice(-12), null, 2)}</pre>
          </details>
        )}
      </section>
    </div>
  );
}
