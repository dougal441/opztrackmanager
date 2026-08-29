# Phase 1: Verified Transaction Foundation - Research

**Researched:** 2026-08-25
**Domain:** Dependency-free Node.js filesystem transactions, source identity pinning, archive verification, and localhost mutation safety
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

<!-- DATA_7F3A9C2B_START -->
### Transaction Lifecycle
- Permit one destructive mutation globally at a time; reject competing requests rather than queueing them.
- Capture source bytes once at operation start and reuse that snapshot throughout the transaction.
- Bind the transaction to the source kind, resolved source root, and captured project identity.
- If a mounted OP-Z disappears or changes, stop immediately, preserve existing data, and never fall back to `opzdisk/`.

### Archive Verification
- Show unverified drafts only as unmistakably unverified items, separate from verified archives and unavailable for restore.
- Write drafts under the library root as hidden partial directories, then publish them by atomic rename only after verification.
- Record SHA-256 and byte length; exact byte comparison and successful OP-Z parsing remain mandatory verification checks.
- Retain a labelled failed copy for diagnosis, segregated from the shelf and unavailable for restore; leave the source slot untouched.

### Status, Guidance, and Errors
- Keep a persistent mounted-OP-Z/local-fixture badge and repeat the active source in destructive confirmations.
- Confirm the operation, source, slot, current song, and whether device data may change.
- Disable mutation controls while work runs, show the current operation, and reject competing requests.
- Give an explicit result plus the relevant eject, reconnect, refresh, or recovery instructions after completion or failure.
<!-- DATA_7F3A9C2B_END -->

### the agent's Discretion

<!-- DATA_51B8DE04_START -->
- Exact hidden-partial and failed-draft naming, retention metadata, and cleanup mechanics may follow the smallest safe filesystem design.
- Exact UI wording and placement may reuse the existing source badge, confirmation dialogs, and toast patterns while meeting the accepted visibility requirements.
<!-- DATA_51B8DE04_END -->

### Deferred Ideas (OUT OF SCOPE)

<!-- DATA_966AC1F7_START -->
None — discussion stayed within phase scope.
<!-- DATA_966AC1F7_END -->
</user_constraints>

<phase_requirements>
## Phase Requirements

<!-- DATA_C18E4D90_START -->
| ID | Description | Research Support |
|----|-------------|------------------|
| ARCH-01 | User can start an archive from a slot whose source bytes and mounted-device identity are captured once for the entire operation | Capture one transaction object containing the existing `device` flag, canonical root, root `stat.dev`, validated slot path, captured `Buffer`, SHA-256, and byte length; pass it explicitly through the workflow. [VERIFIED: `.planning/REQUIREMENTS.md:10`; `server.js:41-63`] |
| ARCH-02 | User receives a verified archive only after the staged `song.opz` is reread, byte-compared with the captured source, reparsed successfully, and recorded with its SHA-256 and byte length | Use `writeFileSync`, `readFileSync`, length equality, `Buffer.equals`, `parseProject`, `crypto.createHash('sha256')`, evidence write, then `renameSync`, in that order. [VERIFIED: `.planning/REQUIREMENTS.md:11`; `server.js:7-14`; `parser.js:87-121`] |
| ARCH-04 | User retains the source slot unchanged whenever archive capture or verification fails | The archive path must never write to the captured project path; errors move or leave the draft hidden and return failure. [VERIFIED: `.planning/REQUIREMENTS.md:13`; current source-writing behavior is isolated in `server.js:361-380`] |
| SAFE-01 | User's destructive operation stops without switching to `opzdisk/` if the captured OP-Z mount disappears or changes during the transaction | Revalidate the pinned canonical root and `stat.dev` directly; do not call `getSource()` after capture because it intentionally falls back. [VERIFIED: `.planning/REQUIREMENTS.md:26`; fallback behavior quoted below from `server.js:55-63`] |
| SAFE-02 | User cannot start destructive operations with invalid slot numbers, bundle identifiers, paths, or concurrent mutation requests | Positive validators run before filesystem access and one global guard rejects a second mutation. User-provided bundle IDs must equal their basename and resolve beneath an allowed library root. [VERIFIED: `.planning/REQUIREMENTS.md:27`; current weak boundaries in `server.js:225-255`] |
| SAFE-03 | User sees whether an operation targeted the mounted OP-Z or local fixture and receives the required eject, reconnect, and refresh guidance | Reuse the source badge, `confirm()`, `toast()`, and shared `api()` path; add operation state and source-specific completion/failure guidance. [VERIFIED: `.planning/REQUIREMENTS.md:28`; `app/index.html:265-301,440-485`] |
<!-- DATA_C18E4D90_END -->
</phase_requirements>

## Summary

Phase 1 should be planned as a narrow hardening of the existing composition root, not a new transaction framework. The current `/api/backup` reads the same slot through `projFile()` twice, `projFile()` resolves `getSource()` each time, and `instrumentsSummary()` resolves it again; a mounted device can therefore disappear and silently redirect later reads to `opzdisk/`. The route also creates a visible bundle before checking stored bytes or reparsing them. [VERIFIED: `server.js:55-63,185-193,234-255,342-359`]

The smallest safe correction is one shared, async-capable global mutation guard in `server.js`, one captured plain object per operation, and explicit passage of that object to source-dependent helpers. Archive into a unique hidden directory under the existing library root, flush and reread `song.opz`, compare exact bytes, call the existing parser on the reread buffer, persist SHA-256 and byte length, revalidate the pinned source, and only then rename to a visible directory. On failure, move the draft beneath one hidden failure container or leave it hidden if that move fails; never remove or change the source slot. [VERIFIED: locked decisions in `01-CONTEXT.md:16-36`; Node APIs cited in Sources]

The UI work should reuse the existing source badge, native `confirm()`, buttons, shared `api()` function, and toast. Browser-local busy state gives immediate feedback; the server guard is still authoritative across tabs and future asynchronous work. No package, manifest, framework, build step, queue, database, recovery daemon, or generalized workflow engine is justified. [VERIFIED: `AGENTS.md:15-22,32-69`; `app/index.html:265-301,440-485`]

**Primary recommendation:** Plan one server-side transaction seam, one verified stage→check→publish archive path, small UI state/guidance changes, and one `node:test` filesystem integration file; defer manifest design and full restore execution exactly as the phase boundary requires. [VERIFIED: `01-CONTEXT.md:7-9,55-59`]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Mutation serialization and input validation | API / Backend | Browser / Client | The server must be authoritative; UI disabling is feedback only. [VERIFIED: `server.js:313-549`; `01-CONTEXT.md:17,31`] |
| Source capture and mount identity checks | API / Backend | Database / Storage | Only the Node process can resolve and stat the mounted/local filesystem. [VERIFIED: `server.js:39-63`] |
| Staged write, byte verification, parse verification, and publication | Database / Storage | API / Backend | Filesystem ordering is the transaction; the route orchestrates it. [VERIFIED: `server.js:145-183,342-359`; `parser.js:87-121`] |
| Operation/source visibility, confirmation, and recovery guidance | Browser / Client | API / Backend | The browser renders intent and results from server-owned facts. [VERIFIED: `app/index.html:265-301,440-485`] |
| OP-Z format validity | API / Backend | — | Existing `parseProject()` is the format gate. [VERIFIED: `parser.js:87-121`] |

## Project Constraints (from AGENTS.md)

- Preserve a verified automatic backup before destructive operations; no app action may make data unrecoverable. A backup is incomplete until stored bytes are checked and the stored `.opz` parses. [VERIFIED: `AGENTS.md:13-17`]
- Keep CommonJS strict-mode JavaScript, the built-in Node HTTP/filesystem architecture, browser-native UI, direct `node server.js` startup, and no dependencies, package install, build step, transpiler, bundler, or framework. [VERIFIED: `AGENTS.md:18-20,32-69`]
- Continue supporting mounted OP-Z disk mode and the `opzdisk/` fallback, but stop a pinned mutation when its mounted source becomes invalid. [VERIFIED: `AGENTS.md:20-21,67-69`]
- Do not expose or commit `data/settings.json` credentials. Normal operation remains quiet; expected failures become JSON errors and user-facing toasts. [VERIFIED: `AGENTS.md:22,95-103`]
- Preserve two-space indentation, semicolons, single quotes, lower-camel-case functions/locals, uppercase module constants, plain objects/arrays, relative CommonJS imports, and co-located browser HTML/CSS/JS. [VERIFIED: `AGENTS.md:77-93`]
- Keep focused helpers near their subsystem in `server.js`; the server remains the composition root and `parser.js` keeps only public parser exports. [VERIFIED: `AGENTS.md:111-120`]
- Use the GSD workflow for implementation edits and require local fixture checks before any hardware acceptance that can alter device data. [VERIFIED: `AGENTS.md:17,210-223`; `01-CONTEXT.md:63-67`]

## Existing Code Findings

The current source selection contract is, verbatim:

```js
function getSource() {
  const dev = findDeviceRoot();
  if (dev) return { ...dev, path: path.join(dev.root, 'projects') };
  const copyRoot = path.join(ROOT, 'opzdisk');
  if (fs.existsSync(path.join(copyRoot, 'projects'))) {
    return { root: copyRoot, path: path.join(copyRoot, 'projects'), device: false, label: 'local copy (opzdisk)' };
  }
  return null;
}
```

[VERIFIED: `server.js:55-63`] This fallback is correct for idle scans but unsafe inside an already-started device transaction.

The existing library paths and bundle layout are, verbatim:

```js
const LIB_DIR = path.join(ROOT, 'library');
const AUTO_DIR = path.join(LIB_DIR, 'auto-backups');
// Bundle = folder in library/: song.opz + info.json + optional samplepacks/
```

[VERIFIED: `server.js:18-20,145-146`] Staging directly beneath `LIB_DIR` keeps the final rename within one parent filesystem and preserves the established bundle layout.

The current archive route creates its final visible directory first and copies from a newly resolved path rather than from `buf`. It records no SHA-256, length, byte comparison, parse result, or verified flag. [VERIFIED: `server.js:342-359`]

The current restore route calls `findBundle()`, `autoBackupSlot()`, `projFile()`, and `getSource()` independently, so it has no single pinned source. Its automatic backup is copied but not reread, compared, or reparsed. [VERIFIED: `server.js:239-255,361-373`]

`findBundle()` uses `path.basename(file)`, which silently turns a path-like input into another identifier instead of rejecting it. Slot inputs reach `String(slot).padStart(...)` without a shared integer/range validator. [VERIFIED: `server.js:232-255,342-388`]

`scanLibrary()` currently discovers any root directory containing `song.opz`, including a hidden partial unless dot-prefixed entries are explicitly skipped. [VERIFIED: `server.js:147-180`]

## Standard Stack

### Core

| Library/API | Version | Purpose | Why Standard |
|-------------|---------|---------|--------------|
| Node.js | 22.22.0 available locally | Runtime and built-in test runner | Matches the project runtime; `node:test` is stable and needs no package. [VERIFIED: local `node --version`; CITED: https://nodejs.org/download/release/v22.22.0/docs/api/test.html] |
| `node:fs` | Node 22.22.0 built-in | Canonical paths, stats, unique drafts, flushed writes, rereads, and rename publication | These are the filesystem primitives already used by the app. [VERIFIED: `server.js:7-14`; CITED: https://nodejs.org/download/release/v22.22.0/docs/api/fs.html] |
| `node:path` | Node 22.22.0 built-in | Root containment and deterministic paths | Already used; `path.relative()`/`path.resolve()` support strict containment checks. [VERIFIED: `server.js:10,16-24`; CITED: https://nodejs.org/download/release/v22.22.0/docs/api/path.html] |
| `node:crypto` | Node 22.22.0 built-in | Full SHA-256 verification evidence and unique names if needed | Already imported; keep the existing MD5 compatibility key separate. [VERIFIED: `server.js:11,37`; `01-CONTEXT.md:49-52`; CITED: https://nodejs.org/download/release/v22.22.0/docs/api/crypto.html] |
| `Buffer.equals()` | Node 22.22.0 built-in | Exact byte comparison | Official Node docs specify exact-byte equality. [CITED: https://nodejs.org/download/release/v22.22.0/docs/api/buffer.html#bufequalsotherbuffer] |
| Existing `parseProject()` | In-repo | Reparse the staged stored bytes | It throws for undersized input and parses all patterns. [VERIFIED: `parser.js:87-121`] |

### Supporting

| API | Purpose | When to Use |
|-----|---------|-------------|
| `fs.realpathSync()` + `fs.statSync(..., { bigint: true })` | Pin canonical root and filesystem device identity | Capture once, then compare directly at every pre-publication/pre-write gate. [CITED: https://nodejs.org/download/release/v22.22.0/docs/api/fs.html] |
| `fs.mkdtempSync()` | Create a collision-resistant hidden draft beneath `library/` | Start each archive draft without a custom uniqueness loop. [CITED: https://nodejs.org/download/release/v22.22.0/docs/api/fs.html] |
| `fs.writeFileSync(..., { flush: true })` | Flush staged bytes before reread | For `song.opz` and verification metadata on the available Node 22 runtime. [CITED: https://nodejs.org/download/release/v22.22.0/docs/api/fs.html#fswritefilesyncfile-data-options] |
| `node:test` + `node:assert/strict` | Dependency-free filesystem and guard tests | One test file covering success, corruption, disappearance, validation, and concurrency. [CITED: https://nodejs.org/download/release/v22.22.0/docs/api/test.html] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Helpers in `server.js` | A new transaction framework/module hierarchy | Adds abstractions and files without another consumer; keep orchestration in the composition root. [VERIFIED: `AGENTS.md:113-120`] |
| One in-memory global guard | Filesystem/database lock or queue | The app is one local Node process and the decision is reject-not-queue; persistent distributed coordination is unnecessary. [VERIFIED: `server.js:551-559`; `01-CONTEXT.md:17`] |
| Existing parser | A second validator | A second parser can disagree and duplicates the accepted format gate. [VERIFIED: `parser.js:87-121`; `01-CONTEXT.md:43-46`] |
| Built-in test runner | Jest/Vitest | Violates the no-package constraint for no benefit in this phase. [VERIFIED: `AGENTS.md:18`; CITED: https://nodejs.org/download/release/v22.22.0/docs/api/test.html] |

**Installation:** None. Do not add `package.json`, a lockfile, dependencies, or a build command. [VERIFIED: `AGENTS.md:18,38-53`]

## Architecture Patterns

### System Architecture Diagram

```text
Browser mutation intent
  -> native confirmation (operation + source + slot/song + device-change warning)
  -> POST JSON + same-origin custom mutation header
  -> validate body and identifier/path allowlists
  -> reject if global mutation guard is occupied
  -> capture exactly one source
       {device flag, label, canonical root, root device id,
        validated project path, source Buffer, SHA-256, byte length}
  -> operation branch
       archive -> hidden draft under library/
                  -> write captured Buffer (never reread source for copying)
                  -> flush -> reread -> length + Buffer.equals
                  -> parseProject(reread) -> write evidence
                  -> revalidate pinned mount/project identity
                  -> atomic rename to visible verified bundle
       restore/future destructive route -> revalidate pinned source immediately
                                           before any device write
  -> explicit JSON result/guidance
  -> release guard in finally

Any validation / mount / write / compare / parse failure
  -> no archive publication and no source-slot write
  -> hidden draft -> library/.failed/ when possible
  -> explicit reconnect/refresh/recovery guidance
  -> release guard in finally
```

This flow implements the locked ordering and keeps external/service boundaries limited to the local browser, Node API, laptop library filesystem, and optional mounted OP-Z. POSIX specifies rename as an atomic directory operation; keeping both names below `LIB_DIR` avoids the cross-filesystem case. [VERIFIED: `01-CONTEXT.md:16-36`; `server.js:313-559`; CITED: https://pubs.opengroup.org/onlinepubs/9799919799/functions/rename.html]

### Recommended Project Structure

```text
server.js                  # existing composition root; transaction helpers and route integration
parser.js                  # existing OP-Z parse gate, unchanged unless tests expose a parser bug
app/index.html             # existing source badge, confirmation, busy state, result guidance
test/
└── transaction.test.js    # one dependency-free Node filesystem integration suite
```

[VERIFIED: existing locations in `AGENTS.md:79-89,134-145`; ASSUMED: proposed `test/transaction.test.js` name]

### Pattern 1: One async-capable guard, released in `finally`

**What:** Keep one module-level active transaction object. Validate before capture; reject if occupied; set it before the first source read; call the operation; always clear it in `finally`. Make the wrapper await the operation even though current filesystem calls are synchronous, so future restore stages cannot accidentally release the lock early. [VERIFIED: `01-CONTEXT.md:17-20,31,55-57`; current single-process root `server.js:313-559`]

**When to use:** Every route that writes the library or device as part of archive/restore/destructive work. Read-only scans do not need the mutation guard. [VERIFIED: `01-CONTEXT.md:7-9,55-59`]

### Pattern 2: Capture once and pass explicitly

**What:** At transaction start, call `getSource()` once, canonicalize and stat its root, validate the slot, read the project once, compute identity from that buffer, and pass the resulting plain object to helpers. Transactional helpers must not call `getSource()` or `projFile()` without the captured source. [VERIFIED: `01-CONTEXT.md:17-20,55-58`; current repeated resolution `server.js:185-193,234-255,342-373`]

**When to use:** Any multi-step operation whose source can be a removable mount. [VERIFIED: `AGENTS.md:20-21`]

### Pattern 3: Hidden stage → verify stored bytes → publish

**What:** Create the draft under `LIB_DIR`, write the captured `Buffer`, flush, reread the stored file, check recorded length and `Buffer.equals`, run `parseProject()` on that reread buffer, persist SHA-256/length evidence, revalidate the pinned source, then rename the directory to a non-hidden shelf name. [VERIFIED: `01-CONTEXT.md:22-26`; CITED: Node fs, buffer, and crypto docs in Sources]

**When to use:** Every archive artifact, including later automatic pre-restore backups. Phase 1 implements the shared primitive and `/api/backup`; Phase 3 consumes it for full restore safety. [VERIFIED: `.planning/REQUIREMENTS.md:10-28`; `01-CONTEXT.md:7-9`]

### Pattern 4: Positive validation and trusted path derivation

**What:** Require integer slots in the existing range, booleans for flags, strings within small length bounds, and exact known bundle IDs. Derive project filenames from validated slots and library paths from server-controlled roots. Reject path-shaped bundle IDs rather than normalizing them with `basename()`. [VERIFIED: existing slot range quoted as `for (let i = 1; i <= 10; i++)` in `server.js:70`; current basename behavior `server.js:251-255`; CITED: https://cornucopia.owasp.org/taxonomy/asvs-5.0/05-file-handling/03-file-storage]

### Anti-Patterns to Avoid

- **Calling `getSource()` mid-transaction:** It can legally fall back to `opzdisk/`; use only the captured object. [VERIFIED: `server.js:55-63`]
- **Copying with `copyFileSync(projFile(...))` after capture:** It defeats capture-once; write the already captured buffer. [VERIFIED: current bug `server.js:346-351`]
- **Making a final shelf directory before checks:** A crash or parse failure leaves an apparently valid archive. [VERIFIED: current behavior `server.js:349-359`; locked correction `01-CONTEXT.md:23-26`]
- **Hiding drafts only with CSS:** Restore eligibility and shelf scans must be enforced server-side. [VERIFIED: current scan/lookup paths `server.js:147-180,251-255`]
- **Route-specific busy flags:** They permit two different destructive endpoints to overlap. One guard owns all mutations. [VERIFIED: `01-CONTEXT.md:17,31,55-57`]
- **Deleting failed drafts automatically:** Retention is required; cleanup is not Phase 1. [VERIFIED: `01-CONTEXT.md:26,35`]
- **Treating browser confirmation as API validation:** Cross-origin or direct HTTP callers bypass UI. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Exact byte equality | Byte loop | `Buffer.equals()` plus explicit recorded length | Built-in exact-byte semantics. [CITED: Node Buffer docs] |
| Hashing | Custom checksum | `crypto.createHash('sha256')` | The requirement specifies SHA-256 and crypto is already imported. [VERIFIED: `server.js:11`; `01-CONTEXT.md:25`; CITED: Node crypto docs] |
| Unique draft allocation | Timestamp retry loop | `fs.mkdtempSync()` under `LIB_DIR` | Avoids second-resolution collisions and stays on the publication filesystem. [CITED: Node fs docs] |
| OP-Z structural verification | New format validator | Existing `parseProject()` | One authoritative in-repo parser. [VERIFIED: `parser.js:87-121`] |
| Mutation coordination | Queue, mutex package, database lock | One module-level active transaction with `try/finally` | One local Node process; reject-not-queue is locked. [VERIFIED: `server.js:551-559`; `01-CONTEXT.md:17`] |
| Path safety | Prefix string checks or basename normalization alone | Positive IDs plus `path.resolve`/`path.relative` containment | OWASP requires trusted/generated names or strict validation. [CITED: OWASP ASVS V5.3.2] |
| Test framework | Jest/Vitest harness | `node:test`, `node:assert/strict`, temp directories | Stable, built-in, CommonJS-compatible. [CITED: Node test docs] |

**Key insight:** The filesystem already supplies every primitive this phase needs. Correctness comes from strict ordering and never resolving the source twice, not from another abstraction layer. [VERIFIED: `AGENTS.md:18,45-55`; CITED: Node fs docs]

## Common Pitfalls

### Pitfall 1: Source fallback after capture
**What goes wrong:** A device transaction begins against `/Volumes/...`, then a later helper calls `getSource()` after disconnect and reads or writes `opzdisk/`. **Why it happens:** source resolution is currently hidden inside `projFile()`, `scanInstruments()`, and `instrumentsSummary()`. **How to avoid:** pass the captured source explicitly and validate its canonical root/device identity before every irreversible stage. **Warning signs:** any transactional call graph still contains a zero-argument `getSource()` or `projFile(slot)`. [VERIFIED: `server.js:55-63,94-126,185-193,234-249`]

### Pitfall 2: Verifying the source buffer instead of stored bytes
**What goes wrong:** Hashing/parsing the original proves the input, not the archive. **Why it happens:** the buffer is already in memory. **How to avoid:** reread draft `song.opz`; all equality, parse, and evidence checks use the reread buffer. **Warning signs:** `parseProject(buf)` occurs before `readFileSync(draftSong)`. [VERIFIED: locked sequence `01-CONTEXT.md:24-26`; current missing verification `server.js:342-359`]

### Pitfall 3: Publishing evidence after rename
**What goes wrong:** a visible archive can exist without verification metadata if the later write fails. **How to avoid:** flush evidence in the hidden draft, then rename once. **Warning signs:** any write to the bundle occurs after publication other than user metadata intentionally handled in later phases. [VERIFIED: `01-CONTEXT.md:23-26`]

### Pitfall 4: Partial and failed bundles leak into restore
**What goes wrong:** `scanLibrary()` treats any directory with `song.opz` as a library item, and `findBundle()` accepts it by basename. **How to avoid:** skip dot-prefixed root entries, keep failures under one hidden container, expose explicit `verified: false` draft diagnostics separately, and require verification evidence for restore eligibility. **Warning signs:** a `.partial-*` item appears in `STATE.library` or a restore button. [VERIFIED: `server.js:147-180,251-255`; `01-CONTEXT.md:23,26`]

### Pitfall 5: Lock release before asynchronous completion
**What goes wrong:** adding an `await` later allows another mutation while the first continues. **How to avoid:** the shared wrapper awaits the callback inside `try/finally`. **Warning signs:** a handler sets/clears the flag itself or returns an unresolved promise from inside the protected block. [VERIFIED: future-compatible consequence of locked global serialization `01-CONTEXT.md:17,31`; CITED: Node async test model]

### Pitfall 6: Browser-only validation and forged localhost mutations
**What goes wrong:** direct/cross-site requests bypass `confirm()` and disabled buttons. **How to avoid:** require JSON plus a custom mutation header, reject cross-site Fetch Metadata/Origin values, and validate again on the server. **Warning signs:** mutation POSTs succeed with `text/plain`, missing custom header, invalid slot types, or path-shaped IDs. [CITED: OWASP CSRF Prevention Cheat Sheet; OWASP ASVS V5.3.2]

### Pitfall 7: Hardware tests mutate the mounted OP-Z
**What goes wrong:** a restore/swap/instrument test overwrites real data before the safety path is proven. **How to avoid:** automate against copied temp fixtures; limit mounted-device UAT to read-only identity/parse and archive-to-laptop checks until an explicit destructive checkpoint. **Warning signs:** a test writes below `/Volumes/OP-Z`. [VERIFIED: `AGENTS.md:15-22`; `01-CONTEXT.md:66-67`]

## Code Examples

Verified Node-core pattern for the archive's critical ordering; proposed helper/field names are [ASSUMED], while the operations and order are locked:

```js
// Sources: Node.js v22 fs/buffer/crypto docs and parser.js:87-121.
const captured = fs.readFileSync(projectPath);
const draft = fs.mkdtempSync(path.join(LIB_DIR, '.partial-'));
const storedPath = path.join(draft, 'song.opz');

fs.writeFileSync(storedPath, captured, { flush: true });
const stored = fs.readFileSync(storedPath);
if (stored.length !== captured.length || !stored.equals(captured)) {
  throw new Error('stored project does not match captured source');
}
parseProject(stored);
const sha256 = crypto.createHash('sha256').update(stored).digest('hex');

// Write and flush verification evidence here, revalidate the pinned source,
// then publish exactly once with fs.renameSync(draft, publishedPath).
```

The values `LIB_DIR`, `'song.opz'`, and `parseProject` are verbatim existing values/symbols. [VERIFIED: `server.js:18,145-146`; `parser.js:87-121`] The `.partial-` prefix and exact error text are implementation-discretion names. [ASSUMED]

Verified containment pattern for any user-selected library identifier; exact helper name is [ASSUMED]:

```js
// Source: Node.js v22 path docs; OWASP ASVS V5.3.2.
function childPath(root, id) {
  if (typeof id !== 'string' || id !== path.basename(id)) throw new Error('invalid identifier');
  const base = fs.realpathSync(root);
  const full = fs.realpathSync(path.resolve(base, id));
  const rel = path.relative(base, full);
  if (!rel || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) throw new Error('invalid identifier');
  return full;
}
```

The exact helper and error names are [ASSUMED]; positive validation plus containment is the prescriptive behavior. The current `findBundle` root choices are verbatim `auto ? AUTO_DIR : LIB_DIR`. [VERIFIED: `server.js:251-255`]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| External test framework required | Stable built-in `node:test` | Stable since Node 20; available in local Node 22.22.0 | Adds deterministic tests without a package or build step. [CITED: Node v22 test docs; VERIFIED: local version check] |
| Write then trust success | Flushed staged write, reread, exact compare, parse, then rename publication | `writeFileSync` gained `flush` in Node 20.10/21.0 | Stored bytes can be checked before visibility. [CITED: Node v22 fs docs] |
| Timestamp-only draft naming | `fs.mkdtempSync()` under the target parent | Long-standing Node built-in | Removes custom collision handling. [CITED: Node v22 fs docs] |

**Deprecated/outdated:** Do not introduce a package-backed mutex, test runner, schema library, or file-copy package; Node 22 and the in-repo parser cover this phase. [VERIFIED: `AGENTS.md:18,40-55`; CITED: Node v22 docs]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Proposed helper names, failure text, `.partial-` prefix, and `test/transaction.test.js` filename. | Architecture / Code Examples | Low; names are explicitly delegated to the agent and do not affect safety behavior. |
| A2 | Verification evidence can temporarily live in existing `info.json` until the versioned Phase 2 manifest. | Architecture | Medium; planner should avoid locking a manifest schema in Phase 1. |
| A3 | A required custom mutation header plus JSON content type and Origin/Fetch-Metadata checks is acceptable for the localhost browser API. | Security Domain | Low; it requires one small `api()` header change and one server guard, with no user-visible setup. |

## Open Questions (RESOLVED)

1. **Interim evidence field names**
   - What we know: SHA-256 and byte length must be recorded; the complete versioned manifest is Phase 2. [VERIFIED: `01-CONTEXT.md:9,25`; `.planning/REQUIREMENTS.md:11-12`]
   - What's unclear: exact interim `info.json` key names are not locked. [ASSUMED]
   - Recommendation: store a small nested verification object now and let Phase 2 wrap/migrate it without changing the verification primitive. [ASSUMED]
   - Resolution: exact nested verification keys remain executor discretion; the required SHA-256 and byte-length values and verification ordering are fixed by the plans.

No user decision is needed before planning; all open naming details are within the agent's stated discretion. [VERIFIED: `01-CONTEXT.md:34-36`]

## Environment Availability

| Dependency | Required By | Available | Version/State | Fallback |
|------------|-------------|-----------|---------------|----------|
| Node.js | Server and tests | ✓ | 22.22.0 | None needed. [VERIFIED: local `node --version`] |
| macOS | Launcher and mounted-volume discovery | ✓ | 26.5.2 | `opzdisk/` for non-hardware fixture work. [VERIFIED: local `sw_vers`; `server.js:41-63,551-559`] |
| Local `opzdisk/` fixture | Automated/safe integration checks | ✓ | Ten normal slot filenames plus one additional fixture file are present | Copy selected `.opz` bytes into test temp directories; never write the checked-in fixture. [VERIFIED: read-only file inventory this session] |
| Mounted OP-Z | Safe live UAT | ✓ | `/Volumes/OP-Z`; ten project files found and all ten parsed successfully in a read-only probe | Automated temp fixture tests remain authoritative before UAT. [VERIFIED: read-only `realpath`, `stat`, file inventory, and `parseProject` probe this session] |
| Third-party packages/build tools | None | Not required | No `package.json`, lockfile, or test framework detected | Use Node built-ins. [VERIFIED: repository inventory; `AGENTS.md:38-53`] |

**Missing dependencies with no fallback:** None. [VERIFIED: environment audit]

**Missing dependencies with fallback:** None. The mounted device is available, but automated checks must still use copied temp fixtures. [VERIFIED: environment audit; `01-CONTEXT.md:66-67`]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Built-in `node:test` on Node 22.22.0 [CITED: https://nodejs.org/download/release/v22.22.0/docs/api/test.html] |
| Config file | none — direct command, no package manifest [VERIFIED: repository inventory; `AGENTS.md:18,38-53`] |
| Quick run command | `node --test test/transaction.test.js` [ASSUMED: proposed filename] |
| Full suite command | `node --test` [CITED: Node v22 test docs] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ARCH-01 | Resolver called once; captured source buffer/root/device identity remain unchanged even if later resolver state changes | unit/integration with temp root and resolver counter | `node --test test/transaction.test.js` | ❌ Wave 0 |
| ARCH-02 | Success publishes only after reread bytes equal captured bytes, parser accepts stored bytes, and SHA-256/length evidence exists | filesystem integration using copied valid `.opz` fixture | `node --test test/transaction.test.js` | ❌ Wave 0 |
| ARCH-04 | Injected corruption/parse failure leaves source bytes equal to pre-test bytes, no visible archive, and a hidden failed draft | filesystem integration using temp source/library | `node --test test/transaction.test.js` | ❌ Wave 0 |
| SAFE-01 | Removing/replacing the captured temp root causes a hard failure and never invokes a configured fallback resolver | filesystem integration | `node --test test/transaction.test.js` | ❌ Wave 0 |
| SAFE-02 | Reject invalid slots, non-boolean flags, path-shaped bundle IDs, escaped paths, and a second mutation held behind a Promise barrier | unit/integration | `node --test test/transaction.test.js` | ❌ Wave 0 |
| SAFE-03 | API state/result includes captured source kind and source-specific guidance; UI shows confirmation/busy/result state | HTTP/static smoke plus manual browser UAT | `node --test test/transaction.test.js` | ❌ Wave 0 |

The test descriptions are derived directly from the six verbatim requirements above. [VERIFIED: `.planning/REQUIREMENTS.md:10-28`]

### Sampling Rate

- **Per task commit:** `node --test test/transaction.test.js` [ASSUMED: proposed filename]
- **Per wave merge:** `node --test` plus `node --check server.js` [CITED: Node test runner; VERIFIED: CommonJS source `server.js:1-14`]
- **Phase gate:** Full automated suite green, then safe mounted-device UAT; no hardware-writing UAT without an explicit checkpoint. [VERIFIED: `01-CONTEXT.md:66-67`; `AGENTS.md:15-22`]

### Wave 0 Gaps

- [ ] `test/transaction.test.js` — one file covering the full test map with `node:test`, `node:assert/strict`, `fs.mkdtempSync()`, and copies of an existing valid `.opz` fixture. [ASSUMED: filename; CITED: Node test/fs docs]
- [ ] Guard `server.listen()` with `require.main === module` and export only the critical transaction/archive helpers needed by the single test file; keep implementation in the existing composition root. [ASSUMED]
- [ ] Add an HTTP/static assertion for JSON/custom-header rejection and the source/guidance payload; do not add a browser test dependency. [CITED: OWASP CSRF guidance; VERIFIED: no-dependency constraint `AGENTS.md:18`]

### Hardware UAT Gate

1. Run all automated tests against temporary copies, never `/Volumes/OP-Z`. [VERIFIED: `AGENTS.md:15-22`]
2. Read-only live check: confirm the badge reports mounted OP-Z and the same slot parses before/after refresh. This is safe and the hardware is currently available. [VERIFIED: environment probe; `01-CONTEXT.md:66-67`]
3. Safe archive check: archive one mounted slot to the laptop library, verify evidence, and byte-compare the device slot before/after. The workflow must make no device write. [VERIFIED: ARCH-02/ARCH-04 in `.planning/REQUIREMENTS.md:11-13`]
4. Any restore, swap, sample-pack mutation, mount-disappearance exercise involving an unsafe disconnect, or other write under `/Volumes/OP-Z` requires an explicit human checkpoint first. [VERIFIED: `01-CONTEXT.md:67`; `AGENTS.md:15-22`]

## Security Domain

Security enforcement is enabled at ASVS Level 1. [VERIFIED: `.planning/config.json:47-49`; verbatim values are `"security_enforcement": true`, `"security_asvs_level": 1`, and `"security_block_on": "high"`.]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | Personal unauthenticated localhost tool; do not add accounts in this phase. [VERIFIED: `.planning/REQUIREMENTS.md:64-65`; server bind `server.js:551`] |
| V3 Session Management | no | No sessions/cookies exist. [VERIFIED: HTTP implementation `server.js:313-559`] |
| V4 Access Control | yes | Server-authoritative mutation boundary; reject cross-site state-changing requests via JSON + required custom header + Origin/Fetch Metadata checks. [CITED: OWASP CSRF Prevention Cheat Sheet] |
| V5 Input Validation | yes | Positive slot/type/boolean/identifier validation and root containment before filesystem access. [CITED: OWASP ASVS 5 V5.3.2; VERIFIED: current boundary `server.js:225-255`] |
| V6 Cryptography | yes | Use built-in SHA-256 only for integrity evidence; do not replace the existing compatibility MD5 identity. [VERIFIED: `01-CONTEXT.md:25,51`; CITED: Node crypto docs] |

### Known Threat Patterns for the Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal / identifier normalization | Tampering | Positive IDs, reject separators/dot paths, resolve beneath trusted root. [CITED: OWASP ASVS V5.3.2] |
| Cross-site POST to localhost mutation API | Spoofing / Tampering | Require non-simple JSON/custom header and validate Origin/Fetch Metadata; never rely only on browser confirmation. [CITED: OWASP CSRF Prevention Cheat Sheet] |
| Source substitution after device removal | Tampering | Pinned realpath/device identity/project bytes; direct revalidation; no resolver fallback. [VERIFIED: `01-CONTEXT.md:17-20`] |
| Partial archive presented as verified | Tampering / Repudiation | Hidden draft, stored-byte equality, parse, evidence, atomic publication. [VERIFIED: `01-CONTEXT.md:22-26`] |
| Error leaks local absolute paths | Information Disclosure | Return stable user guidance and operation context; keep raw path details out of UI/API errors where not needed. [VERIFIED: secrets constraint `AGENTS.md:22`; ASSUMED: exact error wording] |
| Concurrent destructive requests | Tampering / Denial of Service | Single reject-not-queue guard released in `finally`. [VERIFIED: `01-CONTEXT.md:17,31`] |

## Sources

### Primary (HIGH confidence)

- `server.js:7-29,39-63,94-193,223-255,313-388,546-559` — current built-ins, paths, source fallback, scans, validators, archive/restore routes, and server lifecycle opened this session.
- `parser.js:1-121` — current `.opz` format gate and exports opened this session.
- `app/index.html:249-302,328-493` — current API, source badge, archive/restore confirmations, buttons, and toast paths opened this session.
- `.planning/phases/01-verified-transaction-foundation/01-CONTEXT.md:7-74` — accepted phase boundary and decisions opened this session.
- `.planning/REQUIREMENTS.md:8-29` — Phase 1 requirement text opened this session.
- `AGENTS.md:13-120,134-189,210-223` — project safety, stack, conventions, architecture, and workflow constraints opened this session.

### Secondary (MEDIUM confidence)

- https://nodejs.org/download/release/v22.22.0/docs/api/fs.html — official synchronous filesystem, realpath/stat, mkdtemp, flush, and rename documentation.
- https://nodejs.org/download/release/v22.22.0/docs/api/buffer.html#bufequalsotherbuffer — official exact-byte equality documentation.
- https://nodejs.org/download/release/v22.22.0/docs/api/crypto.html#cryptocreatehashalgorithm-options — official hashing documentation.
- https://nodejs.org/download/release/v22.22.0/docs/api/path.html#pathrelativefrom-to — official path containment primitives.
- https://nodejs.org/download/release/v22.22.0/docs/api/test.html — official built-in test runner documentation.
- https://pubs.opengroup.org/onlinepubs/9799919799/functions/rename.html — POSIX.1-2024 atomic rename semantics.
- https://cornucopia.owasp.org/taxonomy/asvs-5.0/05-file-handling/03-file-storage — OWASP ASVS 5 V5.3.2 trusted/generated path requirement.
- https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html — OWASP guidance for state-changing browser APIs.

### Tertiary (LOW confidence)

- None. Proposed names and interim evidence schema are isolated in the Assumptions Log.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no package choice; all runtime APIs are built into the installed Node 22.22.0 and documented officially.
- Architecture: HIGH — derived from accepted decisions and direct reads of every relevant current route/helper.
- Pitfalls: HIGH — each safety failure is traceable to a current call path or locked requirement.
- Validation: HIGH — fixture/hardware availability and absence of existing tests were checked directly; built-in test behavior is documented officially.
- Security: MEDIUM — ASVS/file/CSRF controls are authoritative, while exact localhost header policy remains a planner-level implementation choice.

**Research date:** 2026-08-25
**Valid until:** 2026-09-24 (stable Node-core and in-repo architecture; recheck if runtime or source-resolution code changes)
