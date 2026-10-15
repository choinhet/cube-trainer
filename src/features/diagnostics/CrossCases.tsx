import { Disclosure } from "../../components/ModalPatterns";
import { Button } from "../../components/ui/button";
import { useEffect, useRef, useState } from "react";
import { turn } from "../../domain/cube";
import {
  CROSS_COLORS,
  type CrossCase,
  type CrossColor,
  type CrossQuery,
} from "../../domain/cross";
import { CrossClient, type WorkerMetrics } from "../../workers/cross-client";

/** Solver feasibility inspector. Does not start or record practice attempts. */
export function CrossCases() {
  const client = useRef<CrossClient | null>(null);
  const [color, setColor] = useState<CrossColor>("white");
  const [difficulty, setDifficulty] = useState(1);
  const [caseData, setCaseData] = useState<CrossCase>();
  const [state, setState] = useState("");
  const [prefix, setPrefix] = useState<string[]>([]);
  const [query, setQuery] = useState<CrossQuery>();
  const [metrics, setMetrics] = useState<WorkerMetrics>();
  const [latency, setLatency] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    client.current = new CrossClient();
    return () => {
      client.current?.dispose();
      client.current = null;
    };
  }, []);
  async function inspect(
    nextState: string,
    nextPrefix: string[],
    generated?: CrossCase,
  ) {
    const response = await client.current!.query(
      generated?.color ?? caseData!.color,
      nextState,
    );
    setState(nextState);
    setPrefix(nextPrefix);
    setQuery(response.result);
    setMetrics(response.metrics);
    if (generated) setCaseData(generated);
  }
  async function generate() {
    setBusy(true);
    setError("");
    const started = performance.now();
    try {
      const response = await client.current!.generate(color, difficulty);
      await inspect(response.result.startingState, [], response.result);
      setLatency(performance.now() - started);
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusy(false);
    }
  }
  async function advance(move?: string) {
    setBusy(true);
    setError("");
    try {
      await inspect(
        move ? turn(state, move) : caseData!.startingState,
        move ? [...prefix, move] : [],
      );
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-labelledby="cross-inspector-heading">
      <h2 id="cross-inspector-heading">Exact cross case inspector</h2>
      <p>
        Inspect exact cases and every optimal next move. This does not create a
        practice attempt.
      </p>
      <label>
        Cross color{" "}
        <select
          value={color}
          disabled={busy}
          onChange={(event) => setColor(event.target.value as CrossColor)}
        >
          {CROSS_COLORS.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>{" "}
      <label>
        Exact difficulty{" "}
        <select
          value={difficulty}
          disabled={busy}
          onChange={(event) => setDifficulty(Number(event.target.value))}
        >
          {Array.from({ length: 8 }, (_, i) => (
            <option key={i} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
      </label>{" "}
      <Button variant="outline" disabled={busy} onClick={() => void generate()}>
        Generate cross case
      </Button>
      {busy && (
        <p role="status">Computing exact cross distances in a worker…</p>
      )}
      {error && <p role="alert">{error}</p>}
      {caseData && query && (
        <div>
          <p>
            Case: {caseData.color}, optimum {caseData.optimum} moves
          </p>
          <p>
            Original whole-cube scramble:{" "}
            <code>{caseData.originalScramble}</code>
          </p>
          <Disclosure title="Stable case ID and full target">
            <p>
              <code>{caseData.caseId}</code>
            </p>
            <p>
              Full starting state: <code>{caseData.startingState}</code>
            </p>
            <p>
              Inspected state: <code>{state}</code>
            </p>
          </Disclosure>
          <p>
            Committed prefix: <code>{prefix.join(" ") || "(empty)"}</code>
          </p>
          <p>
            Exact remaining distance:{" "}
            <output aria-label="Exact remaining distance">
              {query.distance}
            </output>
          </p>
          <p>Every optimal next move:</p>
          {query.nextMoves.map((move) => (
            <Button variant="outline"
              disabled={busy}
              key={move}
              onClick={() => void advance(move)}
              aria-label={`Inspect optimal move ${move}`}
            >
              {move}
            </Button>
          ))}
          {!query.distance && (
            <p>Cross complete and aligned to adjacent centers.</p>
          )}
          <p>
            Display continuation:{" "}
            <code>{query.continuation.join(" ") || "(complete)"}</code>
          </p>
          <Button variant="outline" disabled={busy} onClick={() => void advance()}>
            Restore starting case
          </Button>
          {metrics && (
            <p>
              Worker table: {metrics.reachableStates.toLocaleString()} states,
              maximum distance {metrics.maximumDistance}; cold build{" "}
              {metrics.buildMilliseconds.toFixed(1)} ms; request{" "}
              {latency.toFixed(1)} ms; cached tables{" "}
              {metrics.cachedTableBytes.toLocaleString()} bytes; build
              typed-array peak {metrics.peakTypedArrayBytes.toLocaleString()}{" "}
              bytes.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
