import {
  ALGORITHM_CATALOG,
  type CatalogCase,
  type CatalogVariant,
} from "./algorithm-catalog";
import { FACES, normals } from "./cube";
import { COLOR_FACE, type CrossColor } from "./cross";

export interface CatalogMatch {
  startIndex: number;
  endIndex: number;
  case: CatalogCase;
  variant: CatalogVariant;
}
const amount = (move: string) =>
  move.endsWith("2") ? 2 : move.endsWith("'") ? 3 : 1;
/** Opposite faces commute; quarter/half-turn spelling does not define identity. */
function signature(moves: readonly string[], top: string): string {
  const runs: { axis: number; amounts: number[] }[] = [];
  for (const move of moves) {
    const face = FACES.indexOf(move[0]),
      axis = face % 3;
    let run = runs.at(-1);
    if (run?.axis !== axis) {
      run = { axis, amounts: [0, 0] };
      runs.push(run);
    }
    run.amounts[Math.floor(face / 3)] =
      (run.amounts[Math.floor(face / 3)] + amount(move)) % 4;
  }
  const normalized = runs.flatMap((run) =>
    run.amounts.flatMap((n, side) =>
      n ? [FACES[run.axis + side * 3] + n] : [],
    ),
  );
  while (normalized[0]?.[0] === top) normalized.shift();
  while (normalized.at(-1)?.[0] === top) normalized.pop();
  return normalized.join(" ");
}
const dot = (a: number[], b: number[]) =>
  a.reduce((sum, v, i) => sum + v * b[i], 0);
const cross = (a: number[], b: number[]) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const indexByColor = new Map<
  CrossColor,
  Map<string, { case: CatalogCase; variant: CatalogVariant }[]>
>();
function catalogIndex(color: CrossColor) {
  const existing = indexByColor.get(color);
  if (existing) return existing;
  const bottom = normals[FACES.indexOf(COLOR_FACE[color])],
    up = bottom.map((v) => -v);
  const top = FACES[normals.findIndex((n) => dot(n, up) === 1)];
  const index = new Map<
    string,
    { case: CatalogCase; variant: CatalogVariant }[]
  >();
  for (const front of normals.filter((n) => dot(n, up) === 0)) {
    const right = cross(up, front);
    const faces = normals.map(
      (n) =>
        FACES[
          normals.findIndex((candidate) =>
            candidate.every(
              (v, i) => v === n[0] * right[i] + n[1] * up[i] + n[2] * front[i],
            ),
          )
        ],
    );
    for (const c of ALGORITHM_CATALOG.filter((c) => c.phase !== "F2L"))
      for (const variant of c.variants) {
        const key = signature(
          variant.physicalTurns.map(
            (m) => faces[FACES.indexOf(m[0])] + m.slice(1),
          ),
          top,
        );
        if (!key) continue;
        const list = index.get(key) ?? [];
        list.push({ case: c, variant });
        index.set(key, list);
      }
  }
  indexByColor.set(color, index);
  return index;
}
const matchCache = new Map<string, CatalogMatch[]>();
/** Static offline sequences only. Callers verify cube-state endpoints. */
export function catalogMatches(
  moves: readonly string[],
  color: CrossColor,
): CatalogMatch[] {
  const cacheKey = color + ":" + moves.join(" ");
  const cached = matchCache.get(cacheKey);
  if (cached) return cached;
  const index = catalogIndex(color),
    bottom = normals[FACES.indexOf(COLOR_FACE[color])];
  const top = FACES[normals.findIndex((n) => dot(n, bottom) === -1)];
  const matches: CatalogMatch[] = [];
  for (let start = 0; start < moves.length; start++)
    for (
      let end = start + 1;
      end <= Math.min(moves.length, start + 90);
      end++
    ) {
      const key = signature(moves.slice(start, end), top);
      if (!key) continue;
      let coreEnd = end;
      while (coreEnd > start && moves[coreEnd - 1][0] === top) coreEnd--;
      for (const entry of index.get(key) ?? [])
        matches.push({ startIndex: start, endIndex: coreEnd, ...entry });
    }
  if (matchCache.size >= 8) matchCache.delete(matchCache.keys().next().value!);
  matchCache.set(cacheKey, matches);
  return matches;
}
