---
phase: 05-validated-split-half-archives
plan: 01
subsystem: api
tags: [node, opz, archive, split-project, hardware-uat]
requires:
  - phase: 04-split-review-confirmed-intent
    provides: confirmed parent-bound split membership in meta.splits
provides:
  - deterministic confirmed split-half synthesis and verified archive publication
  - server-derived five-outcome hardware acceptance gate for split restores
  - archive shelf status and confirmed-half archive actions
affects: [restore, archive-shelf, hardware-uat]
actuals:
  tokens: 5116
  tasks: 2
  commits: 2
tech-stack:
  added: []
  patterns: [parent-bound byte synthesis, manifest-derived restore eligibility]
key-files:
  created: [.planning/phases/05-validated-split-half-archives/05-01-SUMMARY.md]
  modified: [server.js, app/index.html, test/transaction.test.js]
key-decisions:
  - "Retain original pattern indexes while zeroing omitted payloads and filtering/padding every chain deterministically."
  - "Synthesized archives remain restore-ineligible until exact, versioned five-outcome device evidence matches the stored project hash."
patterns-established:
  - "Archive synthesis rereads and reparses output before publication, while source capture remains independently validated."
requirements-completed: [SPLT-04, SPLT-05]
coverage:
  - id: D1
    description: "Confirmed split halves synthesize deterministic, reparsed archives with repaired chains and immutable parent bytes."
    requirement: SPLT-04
    verification:
      - kind: unit
        ref: "test/transaction.test.js#confirmed split synthesis is deterministic, parent-bound, and repairs chains"
        status: pass
    human_judgment: false
  - id: D2
    description: "Synthesized archives are restore-gated by exact five-outcome sacrificial-device acceptance."
    requirement: SPLT-05
    verification:
      - kind: unit
        ref: "test/transaction.test.js#split archive acceptance stays pending without exact five-outcome evidence"
        status: pass
    human_judgment: true
    rationale: "A real OP-Z is required to verify eject, reconnect, rejection, playback, and recovery behavior."
duration: 14min
completed: 2026-08-27
status: complete
---

# Phase 05 Plan 01: Validated Split-Half Archives Summary

**Confirmed split halves now produce deterministic, verified local archives while restore remains locked behind exact sacrificial-device acceptance.**

## Performance

- **Tasks:** 2
- **Files modified:** 3 implementation/test files
- **Hardware:** pending; no OP-Z was mounted

## Accomplishments

- Added `/api/split/archive` and parent-bound synthesis using existing parser layout constants.
- Preserved selected pattern bytes, cleared omitted payloads, repaired chain references, reread/reparsed output, and retained immutable parent validation.
- Added manifest split provenance, sanitized five-outcome acceptance recording, fail-closed restore checks, and archive-shelf status/actions.

## Task Commits

1. **Task 1: Trace one confirmed half through deterministic synthesis and verified archive** — `a8586bd`
2. **Task 2: Enforce the recorded sacrificial-device restore gate** — `a8586bd` (same coherent implementation commit)

## Verification

- `node --test test/transaction.test.js` — 58 passed, 3 existing mounted-device UATs skipped.
- `node --check server.js` — passed.
- Parser syntax and fixture synthesis checks passed; `parser.js` was read/reused and not modified or staged.
- Hardware acceptance is explicitly pending; fixture success does not unlock restore.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added server-side split provenance and acceptance validation**
- **Found during:** Task 2
- **Issue:** Existing schema classified every verified archive as restore-eligible and had no synthesized-archive provenance.
- **Fix:** Added optional split manifest provenance, bounded acceptance evidence, derived eligibility, and restore fail-closed guard.
- **Files modified:** `server.js`, `app/index.html`, `test/transaction.test.js`
- **Verification:** Focused and full transaction suite pass.
- **Committed in:** `a8586bd`

## Issues Encountered

The OP-Z was not mounted, so direct filesystem/API hardware acceptance could not run and remains pending by design. No `opzdisk/` result was treated as hardware evidence.

## Next Phase Readiness

Local synthesis and restore gating are ready. A real-device UAT must record all five outcomes for the exact synthesized archive before any split archive can be restored.

---
*Phase: 05-validated-split-half-archives*
*Completed: 2026-08-27*
