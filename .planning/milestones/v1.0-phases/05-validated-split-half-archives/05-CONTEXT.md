# Phase 5 Context: Validated Split-Half Archives

## Decisions

- **D-01 — Deterministic synthesis:** Synthesis is available only for a confirmed `meta.splits[parentHash]` intent and must derive bytes from the immutable parent plus the exact selected pattern membership; no heuristic re-selection.
- **D-02 — Binary safety:** Preserve the parent project header and selected pattern bytes, clear unselected pattern payloads, repair every chain reference so no chain points at an omitted pattern, then reread and parse the result and assert retained-pattern fixtures exactly.
- **D-03 — Honest archive status:** A synthesized half is a verified project archive but is restore-ineligible until a recorded sacrificial-device acceptance result exists; local fixture success alone must never enable restore.
- **D-04 — Hardware acceptance sequence:** The recorded acceptance must cover eject, reconnect, device rejection behavior, playback, and recovery of the original project, using direct filesystem/API evidence only.
- **D-05 — No device available now:** Local synthesis, archive, parser, and fixture tests must complete without a mounted OP-Z; the acceptance record remains absent/pending and no restore route may become eligible.

## Autonomous recommendations

- Reuse `meta.splits`, `parseProject()`, `archiveCapturedProject()`/archive classifiers, `findBundle()`, the existing restore eligibility projection, and `test/transaction.test.js`.
- Export the parser's existing pattern-layout constants if the server needs them; do not introduce a binary-format package or a new abstraction layer.
- Store the acceptance record in the synthesized archive manifest as bounded, sanitized evidence. Keep the UI status and restore guard derived from that evidence rather than a separately trusted flag.

## Scope fence

This phase synthesizes and archives confirmed halves, repairs chain references, and gates restoration. It does not change the original `.opz`, clear slots, guess split intent, or enable automatic clearing. Real-device acceptance is an explicit later action; absent hardware leaves synthesized archives retained but restore-ineligible.
