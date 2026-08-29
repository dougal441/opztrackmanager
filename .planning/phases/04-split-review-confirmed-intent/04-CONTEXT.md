# Phase 4 Context: Split Review & Confirmed Intent

## Decisions

- **D-01 — Evidence-only detection:** Surface a likely split suggestion from disjoint saved chains, separated occupied-pattern clusters, and differing musical track profiles; never classify or synthesize a split automatically.
- **D-02 — Explainable evidence:** Show the chain, pattern-cluster, and track-profile evidence used by the suggestion, with disjoint saved chains treated as the strongest signal and the other signals as supporting evidence.
- **D-03 — Explicit review:** Let the user edit exact pattern membership for both halves, name both halves, and confirm or reject the suggestion. Confirmation is the only action that records split intent.
- **D-04 — Stable immutable provenance:** Persist confirmed intent keyed by the parent project content hash, including the parent hash and exact half memberships/names; never write, rewrite, delete, or synthesize the original `.opz` bytes.

## Autonomous recommendations

- Reuse the existing `/api/state` slot projection, `parseProject()`/`parseTrackChunks()` data, inline Archive Shelf interaction style, `data/meta.json` atomic metadata writer, and `test/transaction.test.js` integration harness.
- Store intent in the existing metadata file under a parent-hash keyed `splits` record rather than adding a new database or library bundle. This preserves stable provenance while keeping Phase 5 synthesis separate.
- Keep the detector deterministic and bounded to musical patterns/chains already parsed by the app; do not introduce clustering libraries, dependencies, or a new binary-format abstraction.
- Keep confirmation/rejection browser-local until confirmation; only confirmed intent is persisted. Rejection leaves no mutation and no split record.

## Scope fence

Phase 4 does not synthesize half-project bytes, archive halves, restore halves, clear slots, or perform device writes. Those belong to later phases and must not appear in the plan.
