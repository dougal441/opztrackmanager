---
phase: 03-guarded-restore-instrument-recovery
plan: 02
subsystem: guarded-mutations
tags: [node, filesystem, swap, instruments, recovery]
requires: [03-01]
provides: [guarded slot swap, deep instrument recovery]
affects: [restore, instrument-management]
tech-stack:
  added: []
  patterns: [pinned source, verified deep recovery, exact grid manifest]
key-files:
  created: [.planning/phases/03-guarded-restore-instrument-recovery/03-02-SUMMARY.md]
  modified: [server.js, app/index.html, test/transaction.test.js]
decisions:
  - "Use the existing archiveCapturedProject deep archive as the authoritative complete grid recovery."
  - "Keep clear-slot and authenticated op1.fun installation unavailable."
metrics:
  duration: "~20m"
  completed: 2026-08-27
status: complete
actuals:
  tokens: 12000
  tasks: 2
  commits: 1
---

# Phase 3 Plan 2: Guarded Swap and Instrument Recovery Summary

Two-slot swaps and local instrument actions now require verified retained recovery evidence before mutation and exact post-operation grid verification.

## Accomplishments

- Added strict `/api/swap` execution using one pinned source, two independently published automatic recoveries, verified writes, and dual rollback receipts.
- Enabled local move, remove, import, and snapshot routes behind the global mutation guard and complete `deep: true` grid recovery.
- Added canonical import containment, symlink/regular-file checks, AIFF validation, empty-target enforcement, copy-and-verify move/remove behavior, and exact grid manifests.
- Enabled existing UI controls through `runMutation`; swap confirmation includes both names and recovery scope. Clear-slot and op1.fun install remain fenced.
- Added integration coverage for swap ordering, route inventory, and move/snapshot recovery.

## Verification

- `node --test test/transaction.test.js` — 54 passed, 2 mounted UATs skipped.
- `node --check server.js` — passed.

## Deviations from Plan

None - plan executed within the requested files and constraints.

## Known Stubs

None.

## Self-Check: PASSED

Modified files exist and implementation commit `c49046f` is present.
