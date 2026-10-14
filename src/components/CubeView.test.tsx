// @vitest-environment jsdom
import {
  cleanup,
  render,
  screen,
  fireEvent,
  act,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CubeView, orientationTransform } from "./CubeView";
import { SOLVED, stickers, turn } from "../domain/cube";

it('hides face labels by default and toggles all six labels without changing the cube state', () => {
  const { container, rerender } = render(<CubeView facelets={SOLVED} orientation={null} />);
  expect([...container.querySelectorAll('.cube-tile')].map(tile => tile.textContent).join('')).toBe('');
  rerender(<CubeView facelets={SOLVED} orientation={null} showFaceLabels />);
  expect([...container.querySelectorAll('.cube-tile')].map(tile => tile.textContent).join('')).toBe('URFDLB');
  rerender(<CubeView facelets={SOLVED} orientation={null} showFaceLabels={false} />);
  expect([...container.querySelectorAll('.cube-tile')].map(tile => tile.textContent).join('')).toBe('');
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("cancels decoded M outer-layer motion against the sensor X rotation, preserving the outer body", () => {
  // R-prime / L rotate outer stickers -90 degrees in CSS. The core gyro
  // reports negative X / positive W: its displayed +90 must cancel them.
  const matrix = orientationTransform({
    x: -Math.SQRT1_2,
    y: 0,
    z: 0,
    w: Math.SQRT1_2,
  })
    .slice(9, -1)
    .split(",")
    .map(Number);
  const final = turn(turn(SOLVED, "R'"), "L");
  // White corner at U[8] moves to F[8] in the canonical center frame.
  expect(final[26]).toBe("U");
  const canonicalCorner = [1, 1, 1]; // F[8] in CSS coordinates
  const physical = [0, 1, 2].map((row) =>
    canonicalCorner.reduce(
      (sum, value, col) => sum + matrix[col * 4 + row] * value,
      0,
    ),
  );
  expect(physical[1]).toBeCloseTo(-1); // Still on top, not flipped down.
  expect(physical[2]).toBeCloseTo(1);
});
it("maps GAN white-axis rotation onto the viewer vertical axis", () => {
  const matrix = orientationTransform({
    x: 0,
    y: 0,
    z: Math.SQRT1_2,
    w: Math.SQRT1_2,
  })
    .slice(9, -1)
    .split(",")
    .map(Number);
  expect(matrix[0]).toBeCloseTo(0);
  expect(matrix[2]).toBeCloseTo(-1);
  expect(matrix[5]).toBeCloseTo(1);
});
it("preserves every outer sticker position through repeated M and inverse M while centers move", () => {
  const labels = stickers
    .map((_, index) => String.fromCharCode(65 + index))
    .join("");
  let state = labels;
  let quarters = 0;
  for (const inverse of [false, false, false, false, true, true, true, true]) {
    state = turn(turn(state, inverse ? "R" : "R'"), inverse ? "L'" : "L");
    quarters += inverse ? -1 : 1;
    const matrix = orientationTransform({
      x: -Math.sin((quarters * Math.PI) / 4),
      y: 0,
      z: 0,
      w: Math.cos((quarters * Math.PI) / 4),
    })
      .slice(9, -1)
      .split(",")
      .map(Number);
    stickers.forEach((sticker, original) => {
      if (sticker.position[0] === 0) return;
      const destination = stickers[state.indexOf(labels[original])];
      for (const property of ["position", "normal"] as const) {
        const css = destination[property].map((value, axis) =>
          axis === 1 ? -value : value,
        );
        const physical = [0, 1, 2].map((row) =>
          css.reduce(
            (sum, value, col) => sum + matrix[col * 4 + row] * value,
            0,
          ),
        );
        physical.forEach((value, axis) =>
          expect(value).toBeCloseTo(
            axis === 1 ? -sticker[property][axis] : sticker[property][axis],
          ),
        );
      }
    });
    if (quarters % 4) expect(matrix[5]).not.toBeCloseTo(1); // Sensor pose is not suppressed.
  }
  expect(state).toBe(labels);
});
it("rotates continuously while an arrow is held, stops on release/blur, and completes a full orbit", () => {
  vi.useFakeTimers();
  render(
    <CubeView facelets={SOLVED} orientation={{ x: 0, y: 0, z: 0, w: 1 }} />,
  );
  const view = screen.getByLabelText("Live 3D cube");
  const camera = screen.getByLabelText("Camera orbit");
  const initial = camera.style.transform.slice(9, -1).split(",").map(Number);
  const pose = screen.getByLabelText("Physical orientation").style.transform;
  fireEvent.keyDown(view, { key: "ArrowRight" });
  const started = camera.style.transform.slice(9, -1).split(",").map(Number);
  act(() => vi.advanceTimersByTime(1600));
  expect(
    camera.style.transform.slice(9, -1).split(",").map(Number),
  ).not.toEqual(initial);
  act(() => vi.advanceTimersByTime(1600));
  camera.style.transform
    .slice(9, -1)
    .split(",")
    .map(Number)
    .forEach((value, index) => expect(value).toBeCloseTo(started[index], 6));
  fireEvent.keyUp(view, { key: "ArrowRight" });
  const released = camera.style.transform;
  act(() => vi.advanceTimersByTime(200));
  expect(camera.style.transform).toBe(released);
  fireEvent.keyDown(view, { key: "ArrowUp" });
  act(() => vi.advanceTimersByTime(160));
  fireEvent.blur(view);
  const blurred = camera.style.transform;
  act(() => vi.advanceTimersByTime(200));
  expect(camera.style.transform).toBe(blurred);
  expect(view.getAttribute("data-state")).toBe(SOLVED);
  expect(screen.getByLabelText("Physical orientation").style.transform).toBe(
    pose,
  );
});
it("supports screen-plane roll when dragging near the cube edge without changing state", () => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  render(<CubeView facelets={SOLVED} orientation={null} />);
  const view = screen.getByLabelText("Live 3D cube");
  vi.spyOn(view, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 360,
    height: 360,
    right: 360,
    bottom: 360,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  const camera = screen.getByLabelText("Camera orbit");
  const initialCamera = camera.getAttribute("style");
  fireEvent.pointerDown(view, { clientX: 40, clientY: 180, button: 0 });
  fireEvent.pointerMove(view, { clientX: 70, clientY: 80 });
  expect(camera.getAttribute("style")).toContain("matrix3d");
  expect(camera.getAttribute("style")).not.toBe(initialCamera);
  expect(view.getAttribute("data-state")).toBe(SOLVED);
  fireEvent.pointerUp(view);
  const released = camera.getAttribute("style");
  fireEvent.pointerMove(view, { clientX: 180, clientY: 180 });
  expect(camera.getAttribute("style")).toBe(released);
  vi.unstubAllGlobals();
});
it("animates every queued face turn while exposing the latest logical state immediately", () => {
  vi.useFakeTimers();
  const { rerender } = render(
    <CubeView facelets={SOLVED} orientation={null} turns={[]} />,
  );
  const moves = [
    { move: "R", serial: 1, hostMs: 1, deviceMs: 1 },
    { move: "U", serial: 2, hostMs: 2, deviceMs: 2 },
  ];
  const final = turn(turn(SOLVED, "R"), "U");
  rerender(<CubeView facelets={final} orientation={null} turns={moves} />);
  expect(screen.getByLabelText("Live 3D cube").getAttribute("data-state")).toBe(
    final,
  );
  expect(screen.getByLabelText("Turning layer").getAttribute("data-move")).toBe(
    "R",
  );
  expect(screen.getByLabelText("Turning layer").children.length).toBe(21);
  act(() => vi.advanceTimersByTime(100));
  expect(screen.getByLabelText("Turning layer").getAttribute("data-move")).toBe(
    "U",
  );
  act(() => vi.advanceTimersByTime(100));
  expect(screen.queryByLabelText("Turning layer")).toBe(null);
});
it("shows recovered slice stickers immediately without replaying a late outer-face animation", () => {
  vi.useFakeTimers();
  const { rerender } = render(
    <CubeView facelets={SOLVED} orientation={null} turns={[]} />,
  );
  const first = { move: "R'", serial: 1, hostMs: 1, deviceMs: 1 };
  rerender(
    <CubeView
      facelets={turn(SOLVED, "R'")}
      orientation={null}
      turns={[first]}
    />,
  );
  const final = turn(turn(SOLVED, "R'"), "L");
  rerender(
    <CubeView
      facelets={final}
      orientation={{ x: -Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 }}
      turns={[
        first,
        { move: "L", serial: 2, hostMs: 720, deviceMs: null, recovered: true },
      ]}
    />,
  );
  expect(screen.queryByLabelText("Turning layer")).toBeNull();
  const tiles = screen
    .getByLabelText("Physical orientation")
    .querySelectorAll(".cube-tile");
  expect(
    Array.from(tiles)
      .map((tile) => tile.className.match(/color-(.)/)![1])
      .join(""),
  ).toBe(final);
});
