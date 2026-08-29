---
phase: 03-guarded-restore-instrument-recovery
plan: 01
subsystem: restore
tags: [node, filesystem, archive, sha256, hmac, browser]
requires:
  - phase: 02-verified-archive-shelf-manual-freeing
    provides: Verified schema-1 archive classifier and Archive Shelf evidence
provides:
  - Explicit project restore bound to fresh archive revision, target bytes, and opaque source identity
  - Verified automatic recovery publication before canonical replacement and exact target readback
  - Sanitized non-success recovery receipts for rollback, source loss, and annotation failures
affects: [03-02-swap, 03-03-instrument-recovery, restore]
actuals:
  tokens: 8945
  tasks: 2
  commits: 2
tech-stack:
  added: []
  patterns: [pinned source identity, evidence-bound restore request, same-directory verified write]
key-files:
  created: []
  modified: [server.js, app/index.html, test/transaction.test.js]
key-decisions:
  - "Use a process-local HMAC source token instead of exposing mounted root identity."
  - "Keep project restore project-only; archive sample-pack bytes are never read or written by this route."
  - "Report annotation persistence failure as non-success while retaining verified project output and recovery."
patterns-established:
  - "Canonical writes use an exclusive same-directory temporary file, flush, rename, reread, hash, and parser check."
  - "Post-mutation failures return only validated recovery receipt states."
requirements-completed: [REST-01, REST-02, REST-03, REST-04]
coverage:
  - id: D1
    description: Explicit preview-bound project restore publishes recovery before a verified byte-identical target write.
    requirement: REST-01
    verification:
      - kind: integration
        ref: test/transaction.test.js#project restore requires an explicit fresh target and retains a verified recovery archive
        status: pass
    human_judgment: false
  - id: D2
    description: Post-write failure reports a retained recovery receipt and only reports rollback after exact verification.
    requirement: REST-04
    verification:
      - kind: integration
        ref: test/transaction.test.js#project restore rollback reports verified original bytes after post-write failure
        status: pass
    human_judgment: false
duration: 28min
completed: 2026-08-26
status: complete
---

# Phase 3 Plan 1: Guarded Project Restore Summary

**Explicit single-slot project restore with opaque stale-intent binding, verified automatic recovery, and exact reread proof.**

## Accomplishments

- Enabled only `/api/restore`, requiring reviewed archive revision, explicit slot, source token, and target SHA-256/length.
- Published and reclassified an automatic project-only recovery archive before replacement, then flushed, renamed, reread, hashed, and parsed the target bytes.
- Replaced the dormant restore prompt with an Archive Shelf target selector, live evidence preview, exact confirmation, and focused sanitized recovery result.
- Covered success, source loss, metadata failure, and verified rollback with local integration tests.

## Task Commits

1. **Task 1: Restore one explicitly previewed project through the complete guarded path** — `ef2b97a`
2. **Task 2: Make every post-mutation failure recoverable and truthfully non-successful** — `2fbe727`

## Verification

- `node --test test/transaction.test.js` — 52 passed, 2 mounted UATs skipped by default.
- `node --check server.js` — passed.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Next Phase Readiness

Swap and instrument recovery can reuse the pinned root assertion, verified writer, recovery receipt, and Archive Shelf result treatment.

## Self-Check: PASSED

All three modified files and both task commits exist.
