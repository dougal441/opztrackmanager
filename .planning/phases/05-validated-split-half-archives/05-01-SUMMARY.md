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
  - "Synthesized archives remain restore-ineligible until exact, versioned five-outcome device evidence matches the stored project hash; unobserved playback keeps the gate closed."
patterns-established:
  - "Archive synthesis rereads and reparses output before publication, while source capture remains independently validated."
requirements-completed: [SPLT-04]
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
    rationale: "The real OP-Z passed eject, reconnect, rejection, parse, and recovery; auditory playback remains unobserved."
duration: 14min
completed: 2026-08-27
status: in_progress
---

# Phase 05 Plan 01: Validated Split-Half Archives Summary

**Confirmed split halves now pass real-device format, reconnect, rejection, and recovery checks while restore remains locked pending auditory playback evidence.**

## Performance

- **Tasks:** 2
- **Files modified:** 3 implementation/test files
- **Hardware:** synthesized hash `da23dd688cbd81696e79be9f5c7f2fad4637c68b8def753f20fd44dacd183b4c` accepted after same-device reconnect; selected patterns reparsed; rejection state stayed unchanged; original slot 10 recovered exactly

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

Direct API/filesystem UAT passed eject, same-device reconnect, rejection, parse, and exact original recovery on the physical OP-Z. Auditory playback could not be observed without forbidden screen or physical control, so no five-outcome acceptance record was created and synthesized restore remains safely disabled. No `opzdisk/` result was treated as hardware evidence.

## Next Phase Readiness

Local synthesis and device compatibility are verified. One physical auditory playback confirmation remains before the exact synthesized archive can receive five-outcome acceptance and become restore-eligible.

---
*Phase: 05-validated-split-half-archives*
*Completed: 2026-08-27*

## Self-Check: PASSED

- Summary file exists at the planned path.
- Implementation commit `a8586bd` and summary commit `9b8adcf` are present.
- No parser changes, secrets, generated fixtures, or unrelated files were staged.
