---
phase: 06-hardware-gated-automatic-clearing
plan: 01
subsystem: api
tags: [op-z, clearing, archive, recovery, hardware-gate]
requires:
  - phase: 02-verified-archive-shelf-manual-freeing
    provides: verified complete archive and manual-free fallback
  - phase: 03-guarded-restore-instrument-recovery
    provides: retained automatic recovery transactions
provides:
  - server-owned exact-method automatic clear gate
  - archive-first pinned delete transaction with retained recovery
  - UI action derived only from server eligibility
affects: [hardware-uat, restore, archive-shelf]
actuals:
  tokens: 5488
  tasks: 2
  commits: 1
tech-stack:
  added: []
  patterns: [bounded JSON acceptance record, source-pinned delete, fail-closed recovery guidance]
key-files:
  created: []
  modified: [server.js, app/index.html, test/transaction.test.js]
key-decisions:
  - "Automatic clearing accepts only version 1 delete-project-file evidence with fixture, device, and all six outcomes true."
  - "The bounded acceptance record is present only after all device outcomes passed; no hardware evidence is promoted from opzdisk fixtures."
  - "Every clear publishes a deep verified recovery before unlinking the captured project and reports non-success on unconfirmed state."
requirements-completed: [CLEAR-01, CLEAR-02, CLEAR-03]
coverage:
  - id: D1
    description: Automatic clearing remains unavailable without exact acceptance evidence.
    requirement: CLEAR-01
    verification:
      - kind: integration
        ref: test/transaction.test.js#automatic clear is gated, archives first, and retains recovery on confirmation failure
        status: pass
    human_judgment: false
  - id: D2
    description: Fixture clear archives first, pins the source, and retains recovery on uncertainty.
    requirement: CLEAR-02
    verification:
      - kind: integration
        ref: test/transaction.test.js#automatic clear is gated, archives first, and retains recovery on confirmation failure
        status: pass
    human_judgment: false
  - id: D3
    description: Sacrificial-device eject/reconnect and empty-slot acceptance evidence.
    requirement: CLEAR-03
    verification:
      - kind: hardware
        ref: data/clear-acceptance.json
        status: pass
    human_judgment: true
    rationale: The physical OP-Z passed deletion, reconnect, absent-file empty-slot, playback sanity, and exact recovery checks.
duration: 2min
completed: 2026-08-27
status: complete
---

# Phase 06 Plan 01: Hardware-Gated Automatic Clearing Summary

**Exact delete-project-file clearing passed real-device deletion, reconnect, playback sanity, and recovery checks and is enabled through a bounded method-level gate.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-08-27T02:42:00Z
- **Completed:** 2026-08-27T02:50:28Z
- **Tasks:** 2 (fixture implementation and complete physical hardware acceptance)
- **Files modified:** 3

## Accomplishments

- Added bounded server-side acceptance loading and exact method/device/outcome validation; absent or malformed evidence yields `clearEnabled: false`.
- Replaced the old clear fence with a guarded device-only route that validates fresh fingerprints, creates and verifies a deep recovery archive, deletes only the captured slot file, and returns retained recovery guidance on uncertainty.
- Added server-derived UI rendering and dependency-free fixture tests; the opt-in mounted acceptance test passes only against `/Volumes` hardware.

## Task Commits

1. **Task 1: Trace verified archive through gated delete and confirmation** - `29381f2`
2. **Task 2: Run direct sacrificial-device acceptance and recovery UAT** - passed all six outcomes; production acceptance recorded only after playback and final recovery

## Files Created/Modified

- `server.js` - acceptance reader/validator, derived gate, clear route, and recovery boundary.
- `app/index.html` - automatic control shown only from `STATE.clearEnabled`, with recovery guidance.
- `test/transaction.test.js` - gate, archive-first, recovery, method-level validation, and mounted acceptance coverage.

## Deviations from Plan

Real hardware established that an empty slot is represented by absence of `project10.opz`, not a recreated default project. Existing product logic already uses that representation; one regression assertion now preserves it.

## Issues Encountered

The existing suite emits a known MaxListeners warning; all tests pass.

## Known Stubs

None.

## Hardware Status

On the physical `/dev/disk6` OP-Z, slot 10 was archived and recovered first, deleted, confirmed absent after manual Content Mode return, restored from retained recovery, and confirmed after a second return with exact SHA-256 `ed91476ca975f2f3cafd3503a250a56debe1ad2fbfcf39ae6f1724b2b9465f16`, successful parse, and unchanged rejection state. Subsequent accepted slot-1 playback proved normal device audio after the clear/recovery cycle. `data/clear-acceptance.json` now records all six outcomes for the proven delete-project-file method; the gate applies to the method rather than only the sacrificial project hash.

## Verification

- `node --test test/transaction.test.js` — 62 passed, 4 opt-in mounted-device UATs skipped.
- `node --check server.js` — passed.
- `OPZ_HARDWARE_UAT=1 OPZ_ROOT=/Volumes/OP-Z node --test --test-name-pattern='automatic clear sacrificial-device UAT' test/transaction.test.js` — 1 passed, 0 skipped.
- Live `/api/state` — `clearEnabled: true` for the mounted OP-Z.

## Self-Check: PASSED

Implementation commit `29381f2` exists, all modified files are present, and the final physical-device acceptance is recorded.

---
*Phase: 06-hardware-gated-automatic-clearing*
*Completed: 2026-08-27*
