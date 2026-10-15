# CFOP catalog research — 2026-10-15

This is the separate research/catalog prerequisite for CFOP solve analysis. Catalog version 1.0.0 is a curated offline identification aid, not an inventory of all internet algorithms or a training recommendation.

## Selected source

[Cube Coach, Luke Jackson](https://github.com/lukejacksonn/cube), pinned commit `856b269c63715fbd164b90aee1de5f4725fd277a`, supplies all 41 standard F2L cases, 57 numbered OLL cases, and 21 named PLL cases, with multiple alternatives where available. The primary author's [algorithm data](https://github.com/lukejacksonn/cube/blob/856b269c63715fbd164b90aee1de5f4725fd277a/src/algorithms.ts) has explicit case identities, groups and ordered move lists. It uses standard rotations, wide turns, slices, parentheses, and occasional R3. The offline producer expands parentheses and normalizes notation through cubing's Alg parser without erasing rotations or altering physical records.

The author's [README](https://github.com/lukejacksonn/cube/blob/856b269c63715fbd164b90aee1de5f4725fd277a/README.md) explicitly declares MIT. Preserve the included raw data snapshot, README declaration, attribution and MIT permission notice when redistributing this catalog. The repository has no separate LICENSE file or copyright year; no missing upstream year is invented. The data snapshot and notices are under `catalog-sources/`. This explicit permissive declaration and full coverage make it preferable to copying an unlicensed website collection.

The source lists alternatives but makes no explicit per-variant speed recommendation. `sourceRecommendation: not-stated` records that absence; `sourceOrder` retains its listing order. The catalog selects the first listed independently validated variant as its default for stable identity and reproducibility. This is a catalog policy, not a claim that the source recommends it or that it is optimal for a particular solver.

## Alternatives investigated

- [Logiqx/cubing-algs](https://github.com/Logiqx/cubing-algs) offers broad multi-look coverage and structured data. Its primary LICENSE declares GPLv3; no data was incorporated, avoiding an unnecessary license change for this app.
- [Heroor/cfop](https://github.com/Heroor/cfop) explicitly declares MIT in its README, but its compact picture-oriented case representation has less explicit identity/variant metadata than Cube Coach. No data was incorporated.
- [SpeedCubeDB](https://www.speedcubedb.com/) provides extensive alternatives and community recommendation context. This research did not establish explicit reusable bulk-data permission, so its collection, descriptions and recommendation statistics were not copied. No recommendation ranking is inferred from it.

## Coverage and production

`src/data/cfop-catalog-v1.json` contains 135 entries: 41 F2L, 57 one-look OLL, 21 one-look PLL, 10 two-look OLL (3 edge patterns and 7 corner patterns), and 6 two-look PLL (T/Y corner permutation and Ua/Ub/H/Z edge permutation). Two-look records reuse the corresponding validated sourced variants, retaining attribution. The dot edge algorithm is an explicitly marked catalog composition of the sourced line and wide-F L-pattern operations; `catalog-composition` is not a source recommendation.

Every retained available alternative from the selected snapshot is included after normalized-string deduplication, except OLL 32 source alternative 2 (`R U R' U' R' F R F' ...` in the snapshot): independent cubie evaluation shows it disrupts two lower-layer pairs. It is excluded rather than silently corrected. The other OLL 32 variant retains coverage. The snapshot includes the rejected entry for review; runtime data does not.

Gaps: advanced F2L variants, alternate slot strategies, alternative two-look corner permutation algorithms, and additional community variants outside the selected snapshot are not exhaustive. Solved/skipped cases have no algorithm records. Case numbers for F2L follow the selected source; they are not a universal numbering promise. Two-look edge operations may change corner orientation, and two-look corner permutation operations may change edge permutation: these are expected partial-step effects.

Run `node scripts/produce-catalog.mjs` to reproduce the versioned JSON entirely offline from the pinned snapshot. Application code imports the static data through `src/domain/algorithm-catalog.ts`; neither the producer nor application fetches sources at runtime. Changes to case identity or variant content require a catalog version change.

## Validation and boundaries

The independently implemented cubing 3x3 cubie engine validates phase effects rather than comparing this app's sticker permutations to themselves. For each stored variant, remove final global orientation, inspect its inverse case, and assert it preserves the required lower-layer pieces. PLL also preserves every orientation. F2L affects only one lower corner/edge pair and preserves the cross. Canonicalized OLL orientation patterns, PLL permutations, and F2L target-pair coordinates establish 57/21/41 distinct classes respectively, and require all alternatives under each identity to describe the same class. Schema/provenance tests check normalized notation, unique alternatives, explicit defaults and complete standard numbering. These checks do not assert that a sequence followed by its inverse is meaningful validation.

Cube-state progress analysis remains independent of catalog membership: unfamiliar sequences retain phase analysis. Cross continues to use the existing optimal-solution functionality. This deliverable builds no browsing, drilling or preference UI.
