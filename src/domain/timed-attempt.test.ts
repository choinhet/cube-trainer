import { expect, it } from "vitest";
import {
  TimedAttempt,
  inspectionPenalty,
  formatSolveTime,
} from "./timed-attempt";

it.each([
  [14999, "none"],
  [15000, "+2"],
  [16999, "+2"],
  [17000, "dnf"],
] as const)("uses exact inspection boundary %s", (elapsed, penalty) => {
  expect(inspectionPenalty(elapsed)).toBe(penalty);
});
it("arms once, starts from a subsequent physical event, and completes once with separate wall time", () => {
  const attempt = new TimedAttempt("attempt", "session", true);
  attempt.arm(100);
  attempt.arm(200);
  expect(attempt.phase).toBe("inspection");
  attempt.turn(15100, 123456, false);
  expect(attempt.phase).toBe("active");
  const result = attempt.turn(16434.567, -99999, true);
  expect(result).toMatchObject({
    id: "attempt",
    sessionId: "session",
    startedAt: 123456,
    penalty: "+2",
  });
  expect(result!.rawDurationMs).toBeCloseTo(1334.567, 8);
  expect(attempt.turn(17000, 0, true)).toBeNull();
  expect(formatSolveTime(result!)).toBe("3.33 (+2)");
});
it("keeps DNF raw precision and disables inspection penalties when inspection is off", () => {
  const dnf = new TimedAttempt("dnf", "s", true);
  dnf.arm(0);
  dnf.turn(17000, 1, false);
  expect(dnf.turn(18000.12, 2, true)).toMatchObject({
    rawDurationMs: 1000.119999999999,
    penalty: "dnf",
  });
  const ready = new TimedAttempt("ready", "s", false);
  ready.arm(0);
  ready.turn(90000, 1, false);
  expect(ready.turn(91000, 2, true)?.penalty).toBe("none");
});

it("distinguishes pre-start cancellation, active manual DNF and technical interruption", () => {
  const ready = new TimedAttempt("ready", "s", false);
  ready.arm(1);
  expect(ready.abandon(2)).toBeNull();
  const active = new TimedAttempt("active", "s", false);
  active.arm(1);
  active.turn(10, 100, false);
  expect(active.abandon(123.456)).toMatchObject({
    status: "completed",
    penalty: "dnf",
    rawDurationMs: 113.456,
  });
  expect(active.interrupt(200, "Disconnected")).toBeNull();
  const inspection = new TimedAttempt("inspection", "s", true);
  inspection.arm(1);
  expect(inspection.interrupt(100, "Disconnected")).toMatchObject({
    status: "interrupted",
    reason: "Disconnected",
    interruptionPhase: "inspection",
    solveStarted: false,
  });
});
