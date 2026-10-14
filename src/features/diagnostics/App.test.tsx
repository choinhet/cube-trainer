// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "./App";
import type { Connection } from "../../domain/session";

afterEach(cleanup);
it("offers user-initiated connection, cancel/retry, and explicit state requests", async () => {
  const request = vi.fn(async () => {});
  const connection: Connection = {
    deviceName: "test GAN",
    events$: { subscribe: () => ({ unsubscribe: () => {} }) },
    sendCubeCommand: request,
    disconnect: async () => {},
  };
  const connect = vi
    .fn<() => Promise<Connection>>()
    .mockRejectedValueOnce(
      new DOMException("Chooser cancelled", "NotFoundError"),
    )
    .mockResolvedValue(connection);
  render(<App connectCube={connect} bluetoothAvailable={true} />);
  expect(connect).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Connect cube" }));
  await screen.findByText(/Chooser cancelled/);
  fireEvent.click(screen.getByRole("button", { name: "Connect cube" }));
  await screen.findByText("test GAN");
  fireEvent.click(screen.getByRole("button", { name: "Request state" }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith({ type: "REQUEST_FACELETS" }),
  );
  expect(
    screen
      .getByRole("button", {
        name: "Confirm reported state matches physical cube",
      })
      .hasAttribute("disabled"),
  ).toBe(true);
});

it("explains the secure-context requirement when Bluetooth is unavailable", () => {
  render(<App bluetoothAvailable={false} />);
  expect(screen.getByText(/Use Windows Chrome or Edge/)).toBeTruthy();
  expect(
    screen
      .getByRole("button", { name: "Connect cube" })
      .hasAttribute("disabled"),
  ).toBe(true);
});
