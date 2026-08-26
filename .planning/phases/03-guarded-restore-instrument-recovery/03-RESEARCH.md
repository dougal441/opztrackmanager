# Phase 3: Guarded Restore & Instrument Recovery - Research

**Researched:** 2026-08-27
**Domain:** Dependency-free removable-volume restore transactions, verified recovery receipts, exact whole-grid replacement, and browser-native confirmation
**Confidence:** HIGH for the in-repo architecture; HIGH for host-side byte verification; MEDIUM for mounted filesystem replacement behavior; LOW for post-eject firmware acceptance until physical observation

## Project Constraints (from AGENTS.md)

- Preserve an automatic verified backup before every destructive operation.
- A backup is incomplete until stored bytes reread exactly and the stored `.opz` parses.
- Stop a multi-step mutation when the captured source disappears or changes; never switch a mounted operation to `opzdisk/`.
- Keep the no-dependency Node.js/browser-native stack, no build step, and macOS double-click use.
- Preserve `opzdisk/` compatibility and never expose `data/settings.json` credentials.
- Validate real-device project and instrument writes after fixture tests.

## Locked Decisions

- The target begins unselected and its live project identity is previewed before confirmation.
- Project restore is the default and never includes instruments.
- Whole-grid restore is a separate explicit action with a separate verified pre-restore grid snapshot.
- Every post-mutation failure is non-success and includes a retained recovery reference.
- Source loss prevents further writes, including rollback.
- Phase 3 remains inside `server.js`, `app/index.html`, and `test/transaction.test.js`.
- Automatic project clearing remains Phase 6. Authenticated op1.fun installation stays fenced unless its upstream response can be proved safely.

## Official Hardware Contract

Teenage Engineering documents Content Mode as the place to back up and restore projects and sample packs, requires safe eject before disconnecting, and says changes are applied after eject while the unit synchronizes and restarts. It also says rejected content appears in `rejected` the next time Content Mode is entered. [CITED: https://teenage.engineering/guides/op-z/disk-modes]

The same official guide documents the eight track folders and ten sample-pack slot folders, allows project/sample-pack add, modify, and remove operations, and permits only one sample pack per slot folder. [CITED: https://teenage.engineering/guides/op-z/disk-modes]

The project guide documents ten projects and normal on-device project selection/clearing, but it does not define a host-visible atomic replacement primitive or prove that a host-reread project will be accepted after eject. [CITED: https://teenage.engineering/guides/op-z/project]

**Planning consequence:** Phase 3 can prove Content Mode host bytes, source identity, exact readback, parsing, recovery artifacts, and unchanged unrelated content. It must not claim firmware load/playback acceptance without an explicit safe-eject/reconnect/rejection-folder/device-load check.

## Existing Architecture to Reuse

### One mutation boundary

`withMutation()` rejects rather than queues a second operation and exposes a sanitized active operation. Every Phase 3 write must enter it before source resolution. [VERIFIED: `server.js`, mutation helpers and route dispatch]

### One captured source

`captureSource()` stores the canonical root identity, canonical project path, immutable original bytes, length, and SHA-256. `assertCapturedSource()` proves the same source and original project are still present. [VERIFIED: `server.js`, `captureSource` / `assertCapturedSource`]

An intentional restore changes the project, so the smallest correct extension is to separate:

1. root/projects identity validation, reusable after mutation; and
2. original-project equality validation, required before mutation.

Do not create a transaction class. Two focused functions plus the existing wrapper cover every caller.

### Verified recovery publication

`archiveCapturedProject()` already writes into a hidden draft, flushes, rereads exact bytes, parses, records SHA-256/length evidence, verifies optional whole-grid bytes, revalidates the source, and atomically publishes. Use it with `AUTO_DIR` for recovery; do not create a second backup format. [VERIFIED: `server.js`, `archiveCapturedProject`]

### Fresh archive classification

`classifyArchive()` validates schema 1, reads project evidence through canonical containment, parses stored project bytes, and checks exact sample-pack and snippet evidence. `findBundle()` currently classifies and then separately rereads `song.opz`; close that TOCTOU gap by returning the exact bytes read by the classifier or rereading through evidence and comparing to the classification immediately before use. [VERIFIED: `server.js`, `classifyArchive` / `findBundle`]

### Exact grid evidence

`copyDir()` and `manifestMatches()` already produce and compare sorted `{ path, bytes, sha256 }` evidence and reject symlinks/non-files. Use them for recovery snapshot, staged incoming grid, and live readback. [VERIFIED: `server.js`, `copyDir` / `manifestMatches`]

## Recommended Transaction Designs

### Project restore

1. Strictly validate `file`, `auto`, `slot`, and the expected target fingerprint from the preview.
2. Enter `withMutation()` before any resolver work.
3. Resolve the source once and capture the target project.
4. Freshly revalidate and pin the archive project bytes.
5. Reject if the target fingerprint no longer equals the captured target.
6. Publish a verified automatic recovery archive of the captured target.
7. Recheck root identity, original target equality, and pinned archive bytes.
8. Write the target through one guarded helper using a same-directory temporary file, flush it, then replace the canonical target.
9. Reread the canonical target, require exact buffer equality, SHA-256/length equality, and successful `parseProject()`.
10. Return success with the recovery ID only after all checks pass.

If a failure occurs after canonical replacement starts, attempt rollback only while root identity is still valid. Reread and parse the rollback before reporting `rolled_back`; otherwise report `recovery_required`. Both are non-success responses and retain the recovery ID.

`fs.renameSync(temp, target)` is the shortest same-directory replacement on macOS, but removable-volume semantics are not promised by Node or the OP-Z documentation. Treat it as a write primitive, not a guarantee: flush, reread, and retain recovery evidence. [VERIFIED: Node built-in API used throughout repository; hardware semantics require UAT]

### Project swap

Capture both slots from one pinned source, create and verify two automatic recovery archives, and revalidate both originals before either write. Write/verify both; if either later step fails, return non-success even when verified rollback succeeds. Return both recovery IDs. Do not model swap as two calls to restore because that would release the mutation guard between writes.

### Whole-grid restore

The archive's `samplepacks.files` manifest defines both expected files and expected absences. Overlay copy is incorrect because stale live files would survive.

The smallest safe sequence is:

1. capture/pin source root;
2. publish a verified deep automatic recovery snapshot;
3. copy archived `samplepacks/` into a same-parent staged directory and verify it;
4. recheck source identity and original live-grid manifest;
5. replace the live grid using a retained old-grid sibling, then verify exact output;
6. remove the retained old grid only after verification;
7. on failure, restore the retained grid only while the same source is still valid, then verify it.

Do not use an overlay or 80 independent transactions. One batch owns the recovery receipt and exact final manifest.

### Individual instrument actions

Re-enable only actions that use the same captured-root and recovery boundary. For move/swap/remove/import, a complete verified grid snapshot is the simple authoritative preimage; 80 small slots do not justify a second recovery schema. Snapshot is read-only on the device but must still pin the source and verify laptop bytes.

Import paths must resolve canonically beneath the existing allowed Music root, reject symlinks/escapes, require an empty target, parse the AIFF through existing `packInfo()`, write staged bytes, and reread exact output. Cross-volume removal must copy into recovery/trash and verify before deleting; never depend on `rename` from the OP-Z volume.

Keep `/api/op1fun/download` fenced in this phase. The current helper follows arbitrary redirects, has no response-size bound, and the authenticated upstream contract was not verified without credentials. Enabling local restore/instrument recovery does not require this external write path.

## Failure Model and Public Receipt

One small public shape is enough:

```json
{
  "code": "RESTORE_READBACK_FAILED",
  "recovery": { "id": "...", "auto": true, "state": "rolled_back" },
  "guidance": "Restore did not complete. The verified recovery archive was retained."
}
```

Sanitize all values. Never return mounted paths, device/inode values, temporary names, raw stack messages, or credentials. Attach `recovery` to the existing safe error serializer instead of adding a second response channel.

## UI Recommendation

Extend each verified archive's existing native `<details>` row. In its action group:

- show a native `<select>` with a placeholder and slots 1–10;
- after selection, render the current slot name, source, hash prefix, tempo, and matrix already present in state;
- require one native confirmation for project restore through `runMutation()`;
- show `restore project` as primary and `restore whole instrument grid` as a separate secondary action only for complete grid evidence;
- announce the recovery receipt and final verification in the existing live result region.

No modal framework, wizard, router, component extraction, or duplicate slot fetch is needed. `/api/state` already provides live slot facts; the request fingerprint makes stale state fail closed.

## Validation Strategy

Use the existing Node `node:test` suite and temporary roots. Required failpoints:

- stale target after preview;
- archive changed after classification;
- recovery publication failure before mutation;
- source disappearance before write and after write;
- short/corrupt write or readback mismatch;
- rollback success versus rollback impossible;
- exact grid replacement removes stale files;
- fallback source never receives a mounted transaction;
- recovery ID appears in every post-mutation non-success response;
- no restore action on diagnostic archives.

Mounted UAT must run only when the detected source is a device. Archive one live slot, restore those exact same bytes to that slot, perform a same-byte whole-grid restore, verify readback and recovery archives, then compare every regular file by path/content while allowing expected canonical project/grid mtimes to change. Restore initial bytes and verify exact final content before the test exits.

## Planning Recommendation

Use three vertical plans:

1. guarded project restore plus receipt and local failpoint tests;
2. target-preview UI and two-slot swap using the same transaction;
3. whole-grid recovery plus local instrument actions and mounted API/filesystem UAT.

This keeps every plan executable and testable while avoiding a speculative transaction framework.

