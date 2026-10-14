import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { FACES, normals, stickers, turn } from "../domain/cube";
import type { PhysicalTurn } from "../domain/diagnostic";
export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}
/** GAN frame is +X red, +Y blue, +Z white; CSS frame is right/down/front.
 * Quaternion vector components are axial: this reflected basis negates X.
 */
export function orientationTransform(q: Quaternion | null): string {
  if (!q) return "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)";
  const length = Math.hypot(q.x, q.y, q.z, q.w);
  if (!Number.isFinite(length) || length === 0)
    return orientationTransform(null);
  return quaternionTransform({
    x: -q.x / length,
    y: q.z / length,
    z: q.y / length,
    w: q.w / length,
  });
}
function quaternionTransform({ x, y, z, w }: Quaternion): string {
  return `matrix3d(${[1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0, 2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0, 2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0, 0, 0, 0, 1].join(",")})`;
}
function multiply(a: Quaternion, b: Quaternion): Quaternion {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}
function sphere(x: number, y: number, rect: DOMRect): [number, number, number] {
  const radius = Math.max(1, Math.min(rect.width, rect.height) / 2);
  const sx = (x - rect.left - rect.width / 2) / radius;
  const sy = (y - rect.top - rect.height / 2) / radius;
  const length = Math.hypot(sx, sy);
  return length > 1
    ? [sx / length, sy / length, 0]
    : [sx, sy, Math.sqrt(1 - length * length)];
}
const transforms = [
  "rotateX(90deg)",
  "rotateY(90deg)",
  "",
  "rotateX(-90deg)",
  "rotateY(-90deg)",
  "rotateY(180deg)",
];
interface Frame {
  facelets: string;
  move: string;
  id: string;
}
const noTurns: PhysicalTurn[] = [];
export function CubeView({
  facelets,
  orientation,
  turns = noTurns,
  showFaceLabels = false,
}: {
  facelets: string | null;
  orientation: Quaternion | null;
  turns?: PhysicalTurn[];
  showFaceLabels?: boolean;
}) {
  const seen = useRef({
    count: turns.length,
    last: turns.at(-1)?.hostMs,
    facelets,
  });
  const [frames, setFrames] = useState<Frame[]>([]);
  useLayoutEffect(() => {
    const previous = seen.current;
    const continued =
      previous.count === 0 ||
      turns[previous.count - 1]?.hostMs === previous.last;
    const fresh = continued ? turns.slice(previous.count) : [];
    seen.current = {
      count: turns.length,
      last: turns.at(-1)?.hostMs,
      facelets,
    };
    if (
      !facelets ||
      !continued ||
      (facelets !== previous.facelets && fresh.length === 0)
    ) {
      setFrames([]);
      return;
    }
    if (!fresh.length) return;
    let state = fresh.reduceRight(
      (state, event) =>
        turn(
          state,
          event.move.endsWith("'") ? event.move[0] : `${event.move}'`,
        ),
      facelets,
    );
    const added = fresh.map((event) => {
      state = turn(state, event.move);
      return {
        facelets: state,
        move: event.move,
        id: `${event.hostMs}:${event.serial}`,
      };
    });
    const lastRecovered = fresh
      .map((event) => !!event.recovered)
      .lastIndexOf(true);
    // History describes motion the gyro has already shown. Do not replay it
    // against the current sensor pose or hold newer stickers behind old frames.
    setFrames((queue) =>
      lastRecovered < 0 ? [...queue, ...added] : added.slice(lastRecovered + 1),
    );
  }, [facelets, turns]);
  const frame = frames[0];
  useEffect(() => {
    if (!frame) return;
    const timer = window.setTimeout(
      () => setFrames((queue) => queue.slice(1)),
      100,
    );
    return () => window.clearTimeout(timer);
  }, [frame]);
  const displayed = frame?.facelets ?? facelets ?? "?".repeat(54);
  const axis = frame ? normals[FACES.indexOf(frame.move[0])] : null;
  const moving = (index: number): boolean =>
    !!axis &&
    stickers[index].position.reduce(
      (sum, value, i) => sum + value * axis[i],
      0,
    ) === 1;
  function tile(index: number) {
    const { position, normal } = stickers[index];
    const coordinates = position.map((value, i) => value * 60 + normal[i] * 30);
    return (
      <span
        key={index}
        className={`cube-tile color-${displayed[index]}`}
        style={{
          transform: `translate3d(${coordinates[0]}px,${-coordinates[1]}px,${coordinates[2]}px) ${transforms[Math.floor(index / 9)]}`,
        }}
      >
        {showFaceLabels && index % 9 === 4 ? FACES[Math.floor(index / 9)] : ""}
      </span>
    );
  }
  const [camera, setCamera] = useState(() =>
    multiply(
      {
        x: Math.sin((-12 * Math.PI) / 180),
        y: 0,
        z: 0,
        w: Math.cos((-12 * Math.PI) / 180),
      },
      {
        x: 0,
        y: Math.sin((-16 * Math.PI) / 180),
        z: 0,
        w: Math.cos((-16 * Math.PI) / 180),
      },
    ),
  );
  const heldKeys = useRef(new Set<string>());
  const orbitTimer = useRef<number | null>(null);
  function stopOrbit(): void {
    heldKeys.current.clear();
    if (orbitTimer.current !== null) window.clearInterval(orbitTimer.current);
    orbitTimer.current = null;
  }
  useEffect(
    () => () => {
      if (orbitTimer.current !== null) window.clearInterval(orbitTimer.current);
    },
    [],
  );
  function orbit(): void {
    const keys = heldKeys.current;
    const x = Number(keys.has("ArrowDown")) - Number(keys.has("ArrowUp"));
    const y = Number(keys.has("ArrowRight")) - Number(keys.has("ArrowLeft"));
    const angle = Math.PI / 200; // 1.8 degrees per 16 ms: a full orbit in 3.2 s.
    setCamera((previous) =>
      multiply(
        multiply(
          { x: x * Math.sin(angle), y: 0, z: 0, w: Math.cos(x * angle) },
          { x: 0, y: y * Math.sin(angle), z: 0, w: Math.cos(y * angle) },
        ),
        previous,
      ),
    );
  }
  const drag = useRef<{
    point: [number, number, number];
    pointer: number;
  } | null>(null);
  return (
    <div
      className="cube-view"
      role="img"
      aria-label="Live 3D cube"
      tabIndex={0}
      data-state={facelets ?? "?".repeat(54)}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        drag.current = {
          point: sphere(
            event.clientX,
            event.clientY,
            event.currentTarget.getBoundingClientRect(),
          ),
          pointer: event.pointerId,
        };
      }}
      onPointerMove={(event) => {
        if (!drag.current || drag.current.pointer !== event.pointerId) return;
        const a = drag.current.point,
          b = sphere(
            event.clientX,
            event.clientY,
            event.currentTarget.getBoundingClientRect(),
          );
        const q = {
          x: a[1] * b[2] - a[2] * b[1],
          y: a[2] * b[0] - a[0] * b[2],
          z: a[0] * b[1] - a[1] * b[0],
          w: 1 + a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
        };
        const length = Math.hypot(q.x, q.y, q.z, q.w);
        if (length > 0.00001)
          setCamera((previous) =>
            multiply(
              {
                x: q.x / length,
                y: q.y / length,
                z: q.z / length,
                w: q.w / length,
              },
              previous,
            ),
          );
        drag.current.point = b;
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onLostPointerCapture={() => {
        drag.current = null;
      }}
      onBlur={stopOrbit}
      onKeyUp={(event) => {
        heldKeys.current.delete(event.key);
        if (!heldKeys.current.size) stopOrbit();
      }}
      onKeyDown={(event) => {
        if (
          !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
            event.key,
          )
        )
          return;
        event.preventDefault();
        heldKeys.current.add(event.key);
        if (orbitTimer.current === null) {
          orbit();
          orbitTimer.current = window.setInterval(orbit, 16);
        }
      }}
    >
      <div
        className="cube-camera"
        aria-label="Camera orbit"
        style={{ transform: quaternionTransform(camera) }}
      >
        <div
          className="cube-physical"
          aria-label="Physical orientation"
          style={{ transform: orientationTransform(orientation) }}
        >
          <div className="cube-layer">
            {stickers.map((_, index) => !moving(index) && tile(index))}
          </div>
          {frame && axis && (
            <div
              key={frame.id}
              className="cube-layer cube-turning"
              aria-label="Turning layer"
              data-move={frame.move}
              style={
                {
                  "--turn-from": `rotate3d(${axis[0]},${-axis[1]},${axis[2]},${frame.move.endsWith("'") ? 90 : -90}deg)`,
                } as CSSProperties
              }
            >
              {stickers.map((_, index) => moving(index) && tile(index))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
