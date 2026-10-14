# Issue tracker: Local Markdown

Issues and specs live as Markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`.
- Specs: `.scratch/<feature-slug>/spec.md`.
- Implementation tickets: `.scratch/<feature-slug>/issues/<NN>-<slug>.md`,
  numbered from `01`, with one file per ticket.
- Record triage state in a `Status:` line near the top of each issue.
  See `triage-labels.md` for role strings.
- Append conversation history under `## Comments`.

## Publishing and fetching

When publishing to the issue tracker, create the appropriate spec or
ticket file using the conventions above, creating directories as needed.

When fetching a ticket, read its referenced file.

## Wayfinding operations

- Map: `.scratch/<effort>/map.md`, containing Notes, Decisions-so-far,
  and Fog.
- Child tickets: `.scratch/<effort>/issues/NN-<slug>.md`.
- Record ticket type in `Type:`: research, prototype, grilling, or task.
- Record wayfinding lifecycle in `Status:`: open, claimed, or resolved.
- Record dependencies in `Blocked by: NN, NN`. A ticket is unblocked
  when every dependency is resolved.
- Frontier: select the first open, unblocked, unclaimed ticket by number.
- Claim: set `Status: claimed` and save before starting work.
- Resolve: append the answer under `## Answer`, set `Status: resolved`,
  and append a gist and link to the map's Decisions-so-far section.
