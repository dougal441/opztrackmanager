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
    rationale: "The real OP-Z passed eject, reconnect, rejection, auditory comparison of retained patterns, and exact recovery."
duration: 14min
completed: 2026-08-27
status: complete
---

# Phase 05 Plan 01: Validated Split-Half Archives Summary

**Confirmed split halves pass real-device format, reconnect, rejection, playback, and recovery checks and can become restore-eligible only with exact acceptance evidence.**

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

- `node --test test/transaction.test.js` — 62 passed, 4 opt-in mounted-device UATs skipped.
- `node --check server.js` — passed.
- Parser syntax and fixture synthesis checks passed; `parser.js` was read/reused and not modified or staged.
- Exact five-outcome hardware acceptance now unlocks only the accepted synthesized archive; fixture success alone still does not unlock restore.
- Live `/api/state` — accepted synthesized archive reports `restoreEligible: true` on the mounted OP-Z.

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

Direct API/filesystem UAT passed on the physical OP-Z. For the current slot-1 parent `47c9bf426876efbb25a39b7ac72ff3d6ea45f8fa76899a3f7f2d3f06e728ce6c`, synthesized project `e42fbb2271ac683299e235b036757f902c49255fd9c48164762553118c80baab` retained patterns 0, 4, 6, and 7; the user confirmed all four matched the original recording perfectly. Rejection stayed empty, firmware runtime-state saves preserved the retained pattern set, and the original recovered exactly. Accepted archive `2026-08-28-23-52-50_slot1 patterns 0 4 6 7 hardware accepted_2agHHY` is restore-eligible. No `opzdisk/` result was treated as hardware evidence.

## Next Phase Readiness

Local synthesis, device compatibility, playback, and exact recovery are verified. The accepted synthesized archive is restore-eligible through the existing five-outcome gate.

---
*Phase: 05-validated-split-half-archives*
*Completed: 2026-08-27*

## Self-Check: PASSED

- Summary file exists at the planned path.
- Implementation commit `a8586bd` and summary commit `9b8adcf` are present.
- No parser changes, secrets, generated fixtures, or unrelated files were staged.
