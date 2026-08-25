---
phase: 01-verified-transaction-foundation
fixed_at: 2026-08-25T14:07:40Z
review_path: .planning/phases/01-verified-transaction-foundation/01-REVIEW.md
iteration: 3
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 1: Code Review Fix Report

**Fixed at:** 2026-08-25T14:07:40Z
**Source review:** `.planning/phases/01-verified-transaction-foundation/01-REVIEW.md`
**Iteration:** 3

**Summary:**

- Findings in scope: 4
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: A deep archive verifies successfully when the sample-pack source is absent

**Files modified:** `server.js`, `test/transaction.test.js`
**Commit:** df2ced1
**Status:** fixed: requires human verification
**Applied fix:** Deep capture now requires a canonical source sample-pack directory, always creates the stored directory, and both library verification paths reject a missing stored directory. Regressions cover missing source packs and deletion of an empty stored pack tree.

### CR-02: The audio endpoint returns the credentials file byte-for-byte

**Files modified:** `server.js`, `test/transaction.test.js`
**Commit:** e851bc0
**Status:** fixed
**Applied fix:** Every request now requires the listener's loopback Host, while `/audio` accepts only supported audio extensions whose canonical paths remain under known laptop recording roots or the mounted device's `bounces/`. Regressions cover credential-path denial, hostile GET Host denial, symlink escape denial, and disconnected device roots.

### CR-03: Fail-open JSON persistence can erase existing metadata and credentials

**Files modified:** `server.js`, `test/transaction.test.js`
**Commit:** e9dde6e
**Status:** fixed
**Applied fix:** Metadata and settings updates now use validated fail-closed reads and one atomic temporary-file-plus-rename writer. Display reads remain tolerant. Regressions prove corrupt files remain byte-for-byte unchanged and an injected pre-rename failure preserves valid metadata and removes the temporary file.

### CR-04: A metadata error after publication reports a verified archive as failed

**Files modified:** `server.js`, `test/transaction.test.js`
**Commit:** 6be7a5b
**Status:** fixed: requires human verification
**Applied fix:** Archive publication is now the committed outcome. A later name-annotation failure returns the verified `200` result with `metadataSaved: false` and explicit recovery guidance. The regression proves exactly one visible bundle remains and prior metadata is unchanged.

## Verification

Verification ran in the main checkout because `workflow.use_worktrees=false`.

- `node -c server.js` — passed
- `node -c test/transaction.test.js` — passed
- `node --test test/transaction.test.js` — 29 passed, 1 skipped hardware UAT, 0 failed
- No access or writes were made to `/Volumes/OP-Z`.
- `data/settings.json` was not staged or committed.

---

_Fixed: 2026-08-25T14:07:40Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 3_
