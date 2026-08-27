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
  - "The acceptance record is absent by default; no hardware evidence is created or promoted from opzdisk fixtures."
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
    verification: []
    human_judgment: true
    rationale: No OP-Z is mounted; the opt-in direct UAT skips and data/clear-acceptance.json remains absent.
duration: 2min
completed: 2026-08-27
status: complete
---

# Phase 06 Plan 01: Hardware-Gated Automatic Clearing Summary

**Exact delete-project-file clearing is now archive-first and source-pinned, while absent hardware acceptance keeps the automatic control disabled.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-08-27T02:42:00Z
- **Completed:** 2026-08-27T02:50:28Z
- **Tasks:** 2 (fixture implementation; hardware checkpoint resolved as pending)
- **Files modified:** 3

## Accomplishments

- Added bounded server-side acceptance loading and exact method/device/project/outcome validation; absent or malformed evidence yields `clearEnabled: false`.
- Replaced the old clear fence with a guarded device-only route that validates fresh fingerprints, creates and verifies a deep recovery archive, deletes only the captured slot file, and returns retained recovery guidance on uncertainty.
- Added server-derived UI rendering and dependency-free fixture tests; the opt-in sacrificial-device UAT skips without a mounted OP-Z.

## Task Commits

1. **Task 1: Trace verified archive through gated delete and confirmation** - `29381f2`
2. **Task 2: Run direct sacrificial-device acceptance and recovery UAT** - pending by design; no hardware evidence recorded

## Files Created/Modified

- `server.js` - acceptance reader/validator, derived gate, clear route, and recovery boundary.
- `app/index.html` - automatic control shown only from `STATE.clearEnabled`, with recovery guidance.
- `test/transaction.test.js` - gate, archive-first, recovery, validation, and pending UAT coverage.

## Deviations from Plan

None requiring a code deviation. Hardware UAT was honestly left pending because no OP-Z is mounted; no acceptance record was created.

## Issues Encountered

The existing suite emits a known MaxListeners warning; all tests pass.

## Known Stubs

None in the shipped fixture implementation. Hardware acceptance remains intentionally pending, not stubbed.

## Hardware Status

`OPZ_HARDWARE_UAT=1 node --test --test-name-pattern='automatic clear sacrificial-device UAT' test/transaction.test.js` skips because `OPZ_ROOT` is not set. `data/clear-acceptance.json` was not inspected, created, or staged. Automatic clearing therefore remains disabled by default.

## Verification

- `node --test test/transaction.test.js` — 60 passed, 4 skipped.
- `node --check server.js` — passed.
- Opt-in automatic-clear UAT — 1 skipped with no mounted hardware.

## Self-Check: PASSED

Implementation commit `29381f2` exists and all modified files are present. The summary intentionally does not claim device completion.

---
*Phase: 06-hardware-gated-automatic-clearing*
*Completed: 2026-08-27*
