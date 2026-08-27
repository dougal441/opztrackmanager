---
phase: 03-guarded-restore-instrument-recovery
plan: 03
subsystem: guarded-mutations
tags: [node, filesystem, grid-restore, mounted-uat]
requires: [03-02]
provides: [exact whole-grid restore, retained grid recovery, mounted same-byte UAT]
affects: [restore, instrument-management]
tech-stack:
  added: []
  patterns: [source-token binding, staged sibling replacement, exact manifest readback]
key-files:
  created: [.planning/phases/03-guarded-restore-instrument-recovery/03-03-SUMMARY.md]
  modified: [server.js, app/index.html, test/transaction.test.js]
decisions:
  - "Whole-grid restore is an independent archive action bound to a fresh verified archive revision and source token."
  - "Grid replacement uses a staged sibling and exact manifest evidence, retaining a complete deep recovery before mutation."
metrics:
  duration: "~25m"
  completed: 2026-08-27
status: complete
actuals:
  tokens: 12500
  tasks: 2
  commits: 2
---

# Phase 3 Plan 3: Exact Whole-Grid Restore Summary

Separate source- and archive-bound whole-grid restoration with staged exact replacement, verified recovery, rollback receipts, and direct mounted UAT coverage.

## Accomplishments

- Added `/api/instruments/restore-grid` with strict request validation, pinned source/archive evidence, deep current-grid recovery, hidden same-root staging, exact replacement, and sanitized recovery outcomes.
- Added an independent Archive Shelf whole-grid action using the shared mutation/busy/result flow; project restoration remains separate and the two deferred write routes remain fenced.
- Added local exact-replacement regression coverage and an opt-in mounted Content Mode same-byte project/grid UAT using direct API/filesystem evidence only.

## Verification

- `node --test test/transaction.test.js` — 55 passed, 3 skipped.
- `node --check server.js` — passed.
- Mounted UAT — skipped because no OP-Z source was present under `/Volumes`; it must be rerun with `OPZ_HARDWARE_UAT=1` while a real device is mounted in Content Mode.

## Deviations from Plan

None - plan executed within the requested files and constraints.

## Known Stubs

None.

## Hardware Gate Status

Not passed. No mounted device was available. The opt-in test has a hard real-source assertion and does not substitute fixture evidence.

## Self-Check: PASSED

Implementation commit `06d9c16` exists; all modified files and this summary are present.
