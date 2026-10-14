# Domain Docs

## Layout

This project uses a single-context layout:

- `GLOSSARY.md` at the project root.
- Architecture decision records under `docs/adr/`.

## Before exploring

Read `GLOSSARY.md` and ADRs relevant to the area being explored.

If these files do not exist, proceed silently. Do not flag their absence
or suggest creating them upfront. The domain-modeling skill creates them
lazily as terms and decisions are resolved.

## Use the glossary's vocabulary

Use defined domain terms in issue titles, proposals, hypotheses, and
test names. Avoid synonyms the glossary explicitly excludes.

If a concept is missing, reconsider whether the project uses it or note
the gap for domain-modeling.

## Flag ADR conflicts

Explicitly surface any proposal that contradicts an existing ADR.
Identify the ADR and explain why the decision should be reconsidered.
