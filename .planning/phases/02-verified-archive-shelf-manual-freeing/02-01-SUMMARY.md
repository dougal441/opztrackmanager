---
phase: 02-verified-archive-shelf-manual-freeing
plan: 01
subsystem: archive
tags: [node, filesystem, sha256, manifest, opz]

requires:
  - phase: 01-verified-transaction-foundation
    provides: Hidden-draft archive transaction, stored-byte verification, pinned source identity, and atomic publication
provides:
  - Strict schema-1 info.json archive records classified from current stored bytes
  - Evidence-backed metadata, whole-grid, provenance, and optional contained snippet capture
  - Sanitized action-free diagnostics for legacy, partial, unsupported, corrupt, and tampered bundles
affects: [02-02-archive-shelf, 02-03-manual-freeing, 03-restore]

actuals:
  tokens: 11556
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns: [single stored-byte classifier, stage-verify-publish, canonical recording containment]

key-files:
  created: []
  modified: [server.js, test/transaction.test.js]

key-decisions:
  - "Schema 1 stores only creation time, sanitized source provenance, project evidence, bounded metadata, snippet state/evidence, and whole-grid evidence."
  - "Verified project bytes, whole-song completeness, restore eligibility, and manual-free eligibility remain independent derived facts."
  - "Only canonical regular media files inside existing recording roots are copied; missing and unsafe selections stay explicit non-portable states."

patterns-established:
  - "One classifier: scanLibrary(), findBundle(), and publication verification consume the same current-byte archive classification."
  - "No trusted booleans: verification and completeness are recomputed from schema shape, parser success, hashes, lengths, paths, and regular-file checks."

requirements-completed: [ARCH-03]

coverage:
  - id: D1
    description: "Schema-1 archive records are strictly validated and corrupted or unsupported records remain visible action-free diagnostics."
    requirement: ARCH-03
    verification:
      - kind: integration
        ref: "test/transaction.test.js#archive classification and manifest diagnostics"
        status: pass
    human_judgment: false
  - id: D2
    description: "Archive publication revalidates project, manifest, whole-grid, snippet, and pinned source bytes before the visible rename."
    requirement: ARCH-03
    verification:
      - kind: integration
        ref: "test/transaction.test.js#whole-grid stored evidence and manifest publication"
        status: pass
    human_judgment: false
  - id: D3
    description: "Contained snippets are copied byte-for-byte and unlinked, missing, unavailable, and included states remain explicit."
    requirement: ARCH-03
    verification:
      - kind: integration
        ref: "test/transaction.test.js#snippet capture records included unlinked missing and unavailable states"
        status: pass
    human_judgment: false

duration: 11min
completed: 2026-08-26
status: complete
---

# Phase 2 Plan 1: Versioned Manifest and Stored-Byte Evidence Summary

**Strict schema-1 archives with current-byte project, whole-grid, metadata, provenance, and contained snippet evidence**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-25T21:15:49Z
- **Completed:** 2026-08-25T21:26:48Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added one strict classifier shared by library scanning, bundle lookup, and pre-publication verification.
- Extended the existing hidden-draft transaction to publish bounded metadata, sanitized provenance, whole-grid evidence, and optional contained snippet bytes.
- Kept verified project bytes, archive completeness, restore eligibility, and manual-free eligibility separate while preserving diagnostics without unsafe actions.

## Task Commits

1. **Task 1 RED: Define one strict stored-byte archive classifier** - `e9edfc3`
2. **Task 1 GREEN: Classify archive manifests from stored bytes** - `7958162`
3. **Task 2 RED: Publish portable archive evidence** - `d8e9071`
4. **Task 2 GREEN: Publish complete evidence-backed archives** - `a8d091e`

## Files Created/Modified

- `server.js` - Schema validator/classifier, contained recording resolver, and stage-verify-publish manifest writer.
- `test/transaction.test.js` - Schema, Unicode, tamper, traversal, symlink, snippet-state, publication-order, and source-preservation coverage.

## Decisions Made

- Kept `info.json` as the sole manifest and used exact `schemaVersion: 1`; no schema package or second reader was added.
- A deep whole-grid capture is complete only when snippet status is `included` or `unlinked`; `missing` and `unavailable` remain verified but incomplete.
- Used fixed archive-relative `snippet/recording.<ext>` names so annotation text never becomes a destination path.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The initial complete-record test fixture omitted the required empty `samplepacks/` directory; the fixture was corrected and the classifier remained fail-closed.
- The suite continues to emit its pre-existing `MaxListenersExceededWarning`; all 35 local tests pass and the unrelated opt-in hardware test is skipped by default.

## Known Stubs

None.

## User Setup Required

None - no dependencies, external services, or device access were added.

## Next Phase Readiness

- Plan 02 can render verified/project-only records and separate diagnostics from the classifier's safe projection.
- Plan 03 can re-run `findBundle()`/classification before read-only manual-free guidance; no device-clearing write exists.

## Self-Check: PASSED

All modified files and all four TDD commits were found.

---
*Phase: 02-verified-archive-shelf-manual-freeing*
*Completed: 2026-08-26*
