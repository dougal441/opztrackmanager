# Phase 3: Guarded Restore & Instrument Recovery - Pattern Map

**Mapped:** 2026-08-27
**Files analyzed:** 3 existing files to modify
**Analogs found:** 3 / 3

## Ponytail Scope Guard

Modify only `server.js`, `app/index.html`, and `test/transaction.test.js`. Reuse the existing lock, captured-source object, schema-1 classifier, recovery archive writer, manifest copier, API wrapper, slot renderer, and test hooks. Do not add a transaction class/module, dependency, package manifest, build step, modal library, router, second archive format, partial-grid schema, or cache.

Keep `/api/clear-slot` fenced for Phase 6 and `/api/op1fun/download` fenced until its authenticated download contract is independently validated.

## File Classification

| File | Role | Data Flow | Closest Analog |
|------|------|-----------|----------------|
| `server.js` | composition root / transaction and route owner | archive bytes → recovery → pinned target write → readback receipt | Phase 1 `withMutation` + `captureSource` + `archiveCapturedProject`; Phase 2 `classifyArchive` + `findBundle` |
| `app/index.html` | browser-native restore surface | shelf selection → current slot preview → confirmed mutation → live receipt | Archive Shelf native disclosures + `runMutation()` + result focus |
| `test/transaction.test.js` | integration/security/hardware-gated suite | isolated roots + failpoints + HTTP/static assertions | existing archive, source-substitution, mutation-conflict, shelf, and mounted UAT tests |

## `server.js` Assignments

### Route inventory and request boundary

Promote only implemented Phase 3 routes from `unavailable` to `enabled`. Keep strict JSON body validation adjacent to `validateBackup()`. Every POST remains behind loopback/origin mutation checks before route work.

### Shared source validation

Refactor `assertCapturedSource()` at its root cause into:

- `assertCapturedRoot(captured)` — same canonical root, device/inode, projects path, and source kind;
- `assertCapturedSource(captured)` — calls root check, then proves original project bytes.

Restore uses the full check before mutation and root-only check after intentional replacement. Existing archive callers keep the stronger behavior unchanged.

### Pinned archive bytes

Adjust `classifyArchive()`/`findBundle()` so the bytes used for classification are the bytes returned for restore. Avoid the current classify-then-independent-read seam. Restore eligibility is derived from fresh classification: verified project for project restore; verified complete grid for grid restore.

### One recovery receipt

Add a small helper that attaches `{ id, auto: true, state }` to the existing `transactionError`. Extend the safe serializer to include only this validated shape. Reuse it for restore, swap, and grid/instrument operations.

### One project write helper

Write immutable bytes to a same-directory temporary sibling with `flag: 'wx'` and `flush: true`, rename to the canonical project, reread, exact-compare, hash/length-check, and parse. The caller owns recovery and rollback; the helper owns only one verified write.

### One grid batch

Use `copyDir()` and `manifestMatches()` for incoming staging, live output, and rollback proof. The manifest is the source of truth for absences, so replace the grid rather than overlaying it.

### Existing dynamic helpers to avoid

`projFile()` and `packSlotDir()` call `getSource()` anew. Do not call either inside a Phase 3 transaction. Construct paths only beneath the captured canonical root.

## `app/index.html` Assignments

### Reuse Archive Shelf

Extend the verified archive action region; do not create a Restore page. Each row gets:

- an unselected native slot `<select>`;
- a live target preview from existing `state.slots`;
- `restore project` through the shared mutation wrapper;
- `restore whole instrument grid` as a separate control only when grid evidence is complete.

Diagnostic rows remain action-free.

### Reuse one operation state

Route restore, swap, and instrument actions through `runMutation()`. The existing busy state disables all mutation controls and the existing status/result region announces outcome. Add recovery-receipt rendering there; do not add per-action spinners or state stores.

### Stale-preview binding

Send the slot plus its exact current hash/byte identity from the selected preview. Reset target selection after state refresh if that exact slot no longer matches. Server validation remains authoritative.

### Preserve action separation

Never ask “restore instruments too?” inside project restore. Whole-grid restore gets its own exact confirmation naming the archive, target source, and retained recovery behavior.

## `test/transaction.test.js` Assignments

### Reuse current harness

Use `tempRoots()`, HTTP request helpers, `testHooks`, `snapshotRegularFiles()`, and valid `.opz` fixtures. Keep one test file and built-in `node:test`.

### Smallest high-value checks

- project restore success verifies recovery publication, exact output, parse, and receipt;
- pre-write backup failure leaves target unchanged;
- stale fingerprint and archive tamper fail before write;
- readback failure returns non-success plus recovery ID;
- source disappearance never touches fallback;
- swap protects both slots and reports both recovery IDs;
- grid replacement removes stale files and verifies all evidence;
- UI has no preselected target and diagnostics have no actions;
- whole-grid restore is a distinct control;
- mounted opt-in test proves same-byte restore and exact final content.

## Anti-Patterns

- Calling `getSource()` after mutation begins.
- Treating a missing target as an empty unprotected slot.
- Creating a recovery archive after the target write.
- Reporting success after `writeFileSync` without reread and parse.
- Overlaying archived sample packs onto the live grid.
- Reporting rollback without exact reread proof.
- Returning absolute paths or raw errors in a recovery receipt.
- Re-enabling every dormant route before it shares the guarded path.
- Claiming firmware acceptance from host Content Mode readback.

