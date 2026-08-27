---
status: resolved
trigger: "Mounted Phase 3 restore/grid UAT returns OPERATION_FAILED 500 during whole-grid restore"
created: 2026-08-27
updated: 2026-08-27
---

# Symptoms

- Expected: same-byte project restore and whole-grid restore both return 200, preserve the complete mounted OP-Z tree, and retain verified recovery archives.
- Actual: project restore succeeds, then `/api/instruments/restore-grid` returns sanitized `OPERATION_FAILED` HTTP 500.
- Error: assertion at `test/transaction.test.js:1832`, expected 200 and received 500.
- Timeline: first observed on the first real-device Phase 3 UAT after local fixtures passed.
- Reproduction: `OPZ_ROOT=/Volumes/OP-Z OPZ_HARDWARE_UAT=1 node --test --test-name-pattern='mounted restore and mounted grid' test/transaction.test.js`.

# Current Focus

- hypothesis: Confirmed — whole-grid restore required a second complete grid on the capacity-constrained source even though verified archive and recovery copies already existed on the host.
- test: The regression denies writes to source-root siblings while permitting writes inside the live `samplepacks`; direct in-place restore must succeed and retain a verified host recovery.
- expecting: Restore succeeds without creating `.samplepacks-stage-*` or `.samplepacks-retained-*` on the source, and any post-start failure rolls back from the verified host recovery.
- next_action: Resolved; mounted same-byte project and whole-grid UAT passes with exact whole-tree evidence.
- bug_class: bohrbug

# Evidence

- timestamp: 2026-08-27
  checked: Complete `/api/instruments/restore-grid` route and its helper/caller path.
  found: The generic `OPERATION_FAILED` response can only come from an exception without a valid status/code. Before `started` becomes true, raw filesystem exceptions from stage creation/copy or the first `fs.renameSync(grid, retained)` escape directly; after `started`, `gridRestoreError` assigns a named error.
  implication: The failure is localized before completion of the first live-grid rename, not to second rename, readback verification, or rollback.
- timestamp: 2026-08-27
  checked: Mounted source and retained recovery filesystem metadata.
  found: `/Volumes/OP-Z` is mounted as `msdos` (`fskit`); the retained recovery is on the host filesystem. Both contain the expected top-level tree including `samplepacks`.
  implication: A mounted-filesystem semantic difference is a concrete environment branch; fixture success on the host filesystem does not exercise it.
- timestamp: 2026-08-27
  checked: Spectrum-based fault localization prerequisites.
  found: The only failing reproduction is the hardware-gated test and this environment cannot bind the local test server; no per-test coverage spectrum with one runnable failing and passing test is available.
  implication: SBFL is skipped; deterministic working-backwards and differential filesystem experiments are the applicable route.
- timestamp: 2026-08-27
  checked: Mounted free-space report against the restore route's filesystem layout.
  found: The OP-Z had about 4 MB free while the grid was about 25 MB; the route copied the archive to `.samplepacks-stage-*`, then retained the original as `.samplepacks-retained-*`, both under the device root.
  implication: The route necessarily exhausted device space before the first mutation; the generic 500 was not evidence of unsupported rename semantics.
- timestamp: 2026-08-27
  checked: Host-side recovery guarantees from `archiveCapturedProject`, `resolveChild`, `manifestMatches`, and `gridRestoreError`.
  found: The deep recovery is published and verified on the host before mutation, can be rechecked against the captured live manifest, and is already accepted by `gridRestoreError` as a rollback source.
  implication: Both on-device full-grid copies were redundant; direct replacement can safely roll back from the retained host archive.
- timestamp: 2026-08-27
  checked: Syntax, whitespace, and focused local verification after the fix.
  found: `node --check` passed for `server.js` and `test/transaction.test.js`; `git diff --check` passed; the non-listening whole-grid archive evidence test passed. The new HTTP regression could not bind `127.0.0.1` because the sandbox returned `EPERM`.
  implication: Static and archive/recovery checks pass locally; route execution remains covered by the committed regression for an environment that permits localhost binding.
- timestamp: 2026-08-27
  checked: Mounted rerun after capacity and AppleDouble cleanup fixes.
  found: The same-byte project/grid UAT passed on `/Volumes/OP-Z`, restored the complete device tree exactly, and emitted evidence digest `f19597366ae8e00e318bc00e1e8a4115602d8b100a826a3b788050aef6fed6cf`.
  implication: The real FAT capacity boundary and macOS sidecar behavior are both covered on device.


# Eliminated

- hypothesis: MS-DOS rename semantics caused the first rename to fail.
  reason: The failure occurs earlier while copying a 25 MB staging grid onto a source with about 4 MB free; removing source-root staging directly addresses the reproducible capacity boundary.

# Resolution

- root_cause: `/api/instruments/restore-grid` created a complete staging copy under the OP-Z root and then retained the complete old grid there, requiring capacity for a second grid before replacement. The real device had about 4 MB free for a roughly 25 MB grid, so staging failed with a raw filesystem error that was sanitized to `OPERATION_FAILED`.
- fix: Removed both on-device full-grid copies. The route now verifies the selected host archive, creates and rechecks a deep host recovery, revalidates source identity and the live manifest, restores directly into `samplepacks`, removes macOS-generated AppleDouble sidecars, verifies readback, and rolls back from the host recovery through `gridRestoreError` on any post-start failure.
- verification: Focused regression passed, all 61 local tests passed, and the mounted same-byte project/grid UAT passed with exact whole-tree digest `f19597366ae8e00e318bc00e1e8a4115602d8b100a826a3b788050aef6fed6cf`.
- files_changed: `server.js`, `test/transaction.test.js`, `.planning/debug/resolved/mounted-grid-restore-500.md`
