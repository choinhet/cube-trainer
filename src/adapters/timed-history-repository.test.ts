import { IDBFactory } from "fake-indexeddb";
import { expect, it, vi } from "vitest";
import { LocalRepository } from "./local-repository";
import type { TimedResult } from "../domain/timed-attempt";

async function fixture() {
  const factory = new IDBFactory();
  const repository = new LocalRepository(factory);
  const session = await repository.createSession("History");
  const result: TimedResult = {
    id: "solve",
    sessionId: session.id,
    status: "completed",
    startedAt: 100,
    rawDurationMs: 1234.567,
    penalty: "none",
    timingBasis: "host-monotonic-receipt",
  };
  await repository.saveTimedResult(result);
  return { factory, repository, session, result };
}
it("durably edits only completed penalties and deletes records without altering raw precision", async () => {
  const { factory, repository, result } = await fixture();
  await repository.editTimedPenalty(result.id, "+2");
  expect(await new LocalRepository(factory).listTimedResults()).toEqual([
    { ...result, penalty: "+2" },
  ]);
  await repository.editTimedPenalty(result.id, "dnf");
  expect(await repository.listTimedResults()).toEqual([
    { ...result, penalty: "dnf" },
  ]);
  await repository.editTimedPenalty(result.id, "none");
  await repository.saveTimedResult({
    ...result,
    id: "interrupted",
    status: "interrupted",
    reason: "Disconnected",
  });
  await expect(
    repository.editTimedPenalty("interrupted", "dnf"),
  ).rejects.toThrow("completed");
  await expect(repository.editTimedPenalty("missing", "+2")).rejects.toThrow();
  await repository.deleteTimedResult(result.id);
  expect(await new LocalRepository(factory).listTimedResults()).toEqual([
    expect.objectContaining({ id: "interrupted", status: "interrupted" }),
  ]);
});
it("notifies shared repository subscribers only after committed edits/deletes/session/settings changes", async () => {
  const { factory, repository, result } = await fixture();
  const subscriber = vi.fn();
  const sibling = new LocalRepository(factory);
  const unsubscribe = sibling.subscribe(subscriber);
  await repository.editTimedPenalty(result.id, "+2");
  expect(subscriber).toHaveBeenCalledTimes(1);
  await expect(repository.editTimedPenalty("missing", "+2")).rejects.toThrow();
  expect(subscriber).toHaveBeenCalledTimes(1);
  await repository.selectSession(result.sessionId);
  await repository.saveSettings({ reportingTimezone: "UTC" });
  expect(subscriber).toHaveBeenCalledTimes(3);
  await repository.deleteTimedResult(result.id);
  expect(subscriber).toHaveBeenCalledTimes(4);
  unsubscribe();
  await repository.createSession("Second");
  expect(subscriber).toHaveBeenCalledTimes(4);
});

it("finalization and recovery invalidate derived consumers after persistence, observer failures do not undo writes", async () => {
  const { repository, result } = await fixture();
  const notify = vi.fn();
  const unsubscribe = repository.subscribe(notify);
  const stopBroken = repository.subscribe(() => {
    throw new Error("Observer failed");
  });
  const another = { ...result, id: "finalized" };
  await repository.finalizeTimedAttempt(another);
  expect(notify).toHaveBeenCalledTimes(1);
  expect(
    (await repository.listTimedResults()).find(
      (value) => value.id === another.id,
    ),
  ).toEqual(another);
  await repository.saveCheckpoint({
    kind: "timed",
    id: "unfinished",
    phase: "setup",
    result: { ...result, id: "unfinished", status: "interrupted" },
    facelets: null,
    rawTurns: [],
  });
  expect(notify).toHaveBeenCalledTimes(1);
  await repository.recoverInterruptedAttempts();
  expect(notify).toHaveBeenCalledTimes(2);
  await expect(
    repository.saveSettings({ reportingTimezone: "invalid/zone" }),
  ).rejects.toThrow();
  expect(notify).toHaveBeenCalledTimes(2);
  unsubscribe();
  stopBroken();
});
