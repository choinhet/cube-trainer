import fs from "node:fs";
import vm from "node:vm";
import { Alg } from "cubing/alg";
const raw = fs.readFileSync(
  "docs/research/catalog-sources/cube-coach-algorithms.txt",
  "utf8",
);
const cases = vm.runInNewContext(
  raw
    .slice(raw.indexOf("export const cases"))
    .replace("export const cases: Case[] =", ""),
);
const catalog = cases.map((c) => ({
  id: `${c.type}-${c.name}`,
  phase: c.type.toUpperCase(),
  name: String(c.name),
  look: "one-look",
  group: c.group,
  defaultVariantId: `${c.type}-${c.name}-1`,
  variants: [
    ...new Set(c.moves.map((s) => new Alg(s).expand().toString())),
  ].map((notation, i) => ({
    id: `${c.type}-${c.name}-${i + 1}`,
    notation,
    sourceIds: ["cube-coach"],
    sourceRecommendation: "not-stated",
    sourceOrder: i + 1,
  })),
}));
fs.writeFileSync(
  "src/data/cfop-catalog-v1.json",
  JSON.stringify(catalog, null, 2) + "\n",
);
console.log(catalog.length);
const get = (id) => catalog.find((c) => c.id === id);
// Reject the second source OLL 32 entry: it breaks two lower-layer pairs.
get("oll-32").variants.splice(1, 1);
const add = (id, name, base, step) => {
  const original = get(base);
  const variants = original.variants.map((v, i) => ({
    ...v,
    id: `${id}-${i + 1}`,
  }));
  catalog.push({
    id,
    phase: original.phase,
    name,
    look: "two-look",
    step,
    group: "Two-look",
    defaultVariantId: variants[0].id,
    variants,
  });
};
for (const [name, base] of [
  ["Sune", 27],
  ["Anti-Sune", 26],
  ["H", 21],
  ["Pi", 22],
  ["U", 23],
  ["T", 24],
  ["L", 25],
])
  add(`2look-oll-${base}`, name, `oll-${base}`, "corners");
add("2look-oll-line", "Line", "oll-45", "edges");
add("2look-oll-l", "L shape", "oll-44", "edges");
const line = get("oll-45").variants[0].notation;
// Composition of the two sourced edge orientation operations handles the dot.
const dot = new Alg(`${line} f R U R' U' f'`).expand().toString();
catalog.push({
  id: "2look-oll-dot",
  phase: "OLL",
  name: "Dot",
  look: "two-look",
  step: "edges",
  group: "Two-look",
  defaultVariantId: "2look-oll-dot-1",
  variants: [
    {
      id: "2look-oll-dot-1",
      notation: dot,
      sourceIds: ["cube-coach"],
      sourceRecommendation: "catalog-composition",
    },
  ],
});
for (const name of ["T", "Y", "Ua", "Ub", "H", "Z"])
  add(
    `2look-pll-${name}`,
    name,
    `pll-${name}`,
    ["T", "Y"].includes(name) ? "corners" : "edges",
  );
fs.writeFileSync(
  "src/data/cfop-catalog-v1.json",
  JSON.stringify(catalog, null, 2) + "\n",
);

// Convert reference notation into intrinsic outer turns; whole-cube rotations
// change the holding frame and are not physical face turns in a smart-cube trace.
import { puzzles } from "cubing/puzzles";
const puzzle = await puzzles["3x3x3"].kpuzzle();
const centerFaces = "ULFRBD";
const expansions = {
  r: "x L",
  l: "x' R",
  u: "y D",
  d: "y' U",
  f: "z B",
  b: "z' F",
  M: "R L' x'",
  E: "U D' y'",
  S: "F' B z",
};
function physicalTurns(notation) {
  let frame = puzzle.defaultPattern();
  const moves = [];
  const visit = (family, amount) => {
    const count = ((amount % 4) + 4) % 4;
    if (count !== 1) {
      for (let i = 0; i < count; i++) visit(family, 1);
      return;
    }
    if (expansions[family]) {
      for (const part of new Alg(expansions[family]).experimentalExpand())
        visit(part.family, part.amount);
      return;
    }
    if ("xyz".includes(family)) {
      frame = frame.applyMove(family);
      return;
    }
    const face =
      centerFaces[
        frame.patternData.CENTERS.pieces[centerFaces.indexOf(family)]
      ];
    moves.push(face);
  };
  for (const part of new Alg(notation).experimentalExpand()) {
    // Expand inverse/double slice and rotation moves as positive quarter turns.
    const amount = ((part.amount % 4) + 4) % 4;
    for (let i = 0; i < amount; i++) visit(part.family, 1);
  }
  const runs = [];
  for (const move of moves) {
    const last = runs.at(-1);
    if (last?.[0] === move) last[1]++;
    else runs.push([move, 1]);
  }
  return runs.flatMap(([face, n]) =>
    n % 4 ? [face + (n % 4 === 2 ? "2" : n % 4 === 3 ? "'" : "")] : [],
  );
}
for (const c of catalog)
  for (const v of c.variants) v.physicalTurns = physicalTurns(v.notation);
fs.writeFileSync(
  "src/data/cfop-catalog-v1.json",
  JSON.stringify(catalog, null, 2) + "\n",
);
