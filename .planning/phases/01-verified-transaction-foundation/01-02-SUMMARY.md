---
phase: 01-verified-transaction-foundation
plan: 02
subsystem: localhost-api-safety
tags: [node, http, validation, realpath, concurrency]

requires:
  - phase: 01-01
    provides: Pinned source capture, verified archive publication, and the global mutation guard
provides:
  - One JSON/header/origin trust boundary for every localhost POST mutation
  - Strict slot, boolean, string, pack-type, and bundle identifier validation
  - Canonical realpath containment and verified reread eligibility for library bundles
  - Guard-before-capture HTTP archive dispatch with active conflict facts
  - Explicit Phase 3/6 fences for every unowned device-writing route
affects: [archive-shelf, guarded-restore, instrument-recovery, automatic-clearing]

actuals:
  tokens: 9710
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns: [single POST trust boundary, positive input validation, canonical child containment, explicit phase route fence]

key-files:
  created: []
  modified: [server.js, app/index.html, test/transaction.test.js]

key-decisions:
  - "Every POST passes one JSON, mutation-header, Fetch Metadata, and Origin/Host check before route dispatch."
  - "Bundle selection rejects path-shaped identifiers and accepts only canonical contained directories whose reread bytes parse and match SHA-256/length evidence."
  - "Restore, swap, clear, all instrument writes including snapshot, and op1.fun installation remain explicit 409 fences until their recovery-owning phases."

patterns-established:
  - "Validate before access: reject malformed types and identifiers before resolving or reading filesystem targets."
  - "Guard before capture: accepted backup callbacks alone may resolve and capture a source; conflicts return active public facts without queueing."
  - "Fence unsafe legacy writes centrally and remove their handler bodies rather than retaining unreachable path-copy code."

requirements-completed: [ARCH-01, SAFE-01, SAFE-02]

coverage:
  - id: D1
    description: "Forged, malformed, wrongly encoded, cross-site, and invalidly typed mutation requests fail with stable path-free 4xx responses."
    requirement: SAFE-02
    verification:
      - kind: integration
        ref: "test/transaction.test.js#request boundary rejects forged and malformed mutation requests"
        status: pass
      - kind: integration
        ref: "test/transaction.test.js#input validation rejects invalid types before filesystem access"
        status: pass
    human_judgment: false
  - id: D2
    description: "Library selection rejects traversal, symlink escape, hidden, legacy, corrupt, and evidence-mismatched bundles."
    requirement: SAFE-02
    verification:
      - kind: integration
        ref: "test/transaction.test.js#bundle containment rejects path escapes and unverified items"
        status: pass
    human_judgment: false
  - id: D3
    description: "A competing HTTP backup receives 409 before resolver or capture work while the accepted archive remains guarded and read-only state stays available."
    requirement: ARCH-01
    verification:
      - kind: integration
        ref: "test/transaction.test.js#guard before capture rejects an HTTP competitor with zero source work"
        status: pass
    human_judgment: false
  - id: D4
    description: "Restore, swap, clear, instrument writes, and op1.fun installation cannot mutate device or fixture data before verified recovery exists."
    requirement: SAFE-01
    verification:
      - kind: integration
        ref: "test/transaction.test.js#later-phase routes unavailable before filesystem mutation"
        status: pass
    human_judgment: false

duration: 13 min
completed: 2026-08-25
status: complete
---

# Phase 01 Plan 02: Verified Transaction Boundaries Summary

**One localhost mutation gate, canonical verified bundle selection, zero-work conflict rejection, and explicit fences around every later-phase device write**

## Performance

- **Duration:** 13 min
- **Started:** 2026-08-25T12:48:43Z
- **Completed:** 2026-08-25T13:01:12Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Centralized JSON, custom-header, cross-site, Origin/Host, encoding, and public error checks before POST route work.
- Added positive validators and canonical `realpathSync()`/`path.relative()` containment, with reread parse and evidence checks for restore-eligible bundles.
- Proved HTTP conflicts perform zero source resolution/capture work while the accepted backup remains protected and state stays readable.
- Removed legacy restore, swap, clear, instrument-write, snapshot, and pack-install implementations; all return stable phase guidance and their UI controls remain visibly disabled.

## Task Commits

Each task was committed atomically using TDD:

1. **Task 1 RED: Request, validation, and containment failures** - `d89a118` (test)
2. **Task 1 GREEN: Authoritative mutation trust boundary** - `c34ce94` (feat)
3. **Task 2 RED: HTTP conflict and route-inventory failures** - `1d6a230` (test)
4. **Task 2 GREEN: Later-phase device-write fences** - `6df3fa3` (feat)
5. **Safety follow-up: Fixture-only HTTP state checks** - `7bdc35c` (test)

## Files Created/Modified

- `server.js` - Central POST policy, stable request errors, strict validators, canonical bundle lookup, active conflict facts, and destructive-route fences.
- `app/index.html` - Native-disabled later-phase controls with Phase 3 guidance while keeping backup enabled through the shared mutation funnel.
- `test/transaction.test.js` - Table-driven negative HTTP/input/path checks, HTTP promise-barrier concurrency proof, route inventory, and fixture-only state checks.

## Decisions Made

- Applied the request policy once before POST dispatch; no route maintains its own weaker header or origin check.
- Kept `findBundle()` strict and restore-only: legacy flat files and bundles without matching evidence remain visible elsewhere but cannot be selected.
- Disabled instrument snapshot with the other instrument writes. Preserving it would require a separate guarded source-capture path; Phase 3 owns that recovery contract.
- Kept one minimal mutable test-hook object in `server.js` solely to hold an accepted HTTP backup before source resolution and redirect its archive to a temporary root.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test Bug] Compared canonical macOS temporary paths**
- **Found during:** Task 1 GREEN
- **Issue:** `realpathSync()` correctly returned `/private/var/...` while the test expected the `/var/...` alias.
- **Fix:** Canonicalized the expected bundle directory before comparison.
- **Files modified:** `test/transaction.test.js`
- **Verification:** Task 1 targeted gate and full suite pass.
- **Committed in:** `c34ce94`

**2. [Rule 2 - Missing Critical] Prevented HTTP tests from discovering mounted hardware**
- **Found during:** Final safety audit after Task 2
- **Issue:** State requests used the normal idle resolver and could read a mounted OP-Z during automated tests.
- **Fix:** Pinned both HTTP state checks to temporary copied fixture roots and restored the prior environment afterward.
- **Files modified:** `test/transaction.test.js`
- **Verification:** Full 12-test suite passes using temporary roots only.
- **Committed in:** `7bdc35c`

---

**Total deviations:** 2 auto-fixed (1 Rule 1 test bug, 1 Rule 2 safety requirement)
**Impact on plan:** Both fixes tightened verification without adding runtime dependencies or product scope.

## Issues Encountered

None beyond the auto-fixed test-path and fixture-isolation issues above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 01-03 can render server-owned active operation facts and guidance on top of the complete API boundary.
- Phase 3 must replace the restore fence with immutable verified archive capture, verified target recovery, and post-write byte checks before any device write returns.
- Phase 6 retains exclusive ownership of hardware-validated automatic clearing.

## Self-Check: PASSED

All three modified files, the summary, all five task commits, the 12-test suite, and `node --check server.js` were verified on disk.

---
*Phase: 01-verified-transaction-foundation*
*Completed: 2026-08-25*
