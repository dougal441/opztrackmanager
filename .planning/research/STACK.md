# Technology Stack

**Project:** OP-Z Manager — verified archive/free-slot and split-project backup milestone
**Researched:** 2026-08-20
**Confidence:** MEDIUM — Node and OP-Z content-mode capabilities are documented by their primary sources; the precise device state after deleting a project file still requires hardware validation.

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js, existing CommonJS HTTP server | Node 24 LTS (minimum 20.10) | Archive, restore, verification, and local API routes | Keep the dependency-free architecture. Node 24 LTS is the current maintained LTS release; Node 20.10 introduced `writeFileSync(..., { flush: true })`, which supports the durability step needed for staged archive files. |
| Existing browser UI (`app/index.html`) | Existing | Archive/shelf and confirmation UX | Add screens and API calls in the current single-page UI; this milestone does not justify a frontend framework or a UI refactor. |
| Existing OP-Z parser (`parser.js`) | Existing | Semantic `.opz` verification and split-project construction | Reuse `parseProject`, fixed pattern boundaries, chains, and parsed usage as the format authority. A byte-identical file must still parse successfully before it earns a verified status. |

### Database

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Filesystem bundle plus JSON manifest | Existing Node `fs` | Durable archive records, metadata snapshot, snippet, instrument manifest, and verification evidence | The product is personal and local. Extend the existing library-bundle format rather than introduce SQLite or a database. A bundle directory is portable and directly inspectable. |

### Infrastructure

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| macOS local filesystem and mounted OP-Z content disk | Existing | Source and destination for projects/sample packs | The official OP-Z guide explicitly permits add, modify, and remove operations for projects in content mode; changes take effect after safe eject, device synchronization, and restart. Keep all destructive writes behind the existing local-only server. |
| Fixture copy (`opzdisk/`) | Existing | Safe write-path and split synthesis testing | Make it the default test target. Never use the mounted OP-Z as an automated test fixture. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:fs` (`readFileSync`, `writeFileSync`, `renameSync`, `mkdirSync`, `rmSync`) | Node 24 LTS | Staged file and directory writes | Create a unique sibling staging bundle/file; flush the project write; reread it; parse and compare it; then rename it into its final library name. `copyFileSync` is not a transaction—Node makes no atomicity guarantee. |
| `node:crypto` (`createHash('sha256')`) | Node 24 LTS | Persisted project and payload checksums | Record SHA-256, byte length, and parser summary in the archive manifest. Compare the exact `Buffer`s during the live verification step; SHA-256 is the durable audit record, not a replacement for parse validation. |
| `node:test` + `node:assert/strict` | Node 24 LTS | Fixture-based safety tests | Add small `node --test` tests for archive verification, failure preservation, target auto-backup, and deterministic split synthesis. The test runner and strict assertions are built in. |
| Existing helpers: `copyDir`, `autoBackupSlot`, `safeName`, `hashFile`, `parseProject` | Existing | Preserve established source selection and backup behavior | Strengthen these at the one shared archive/restore boundary; do not duplicate safety guards per route. |

## Recommended Transaction Protocol

1. Read the source `.opz` once into a `Buffer`; parse it before making an archive.
2. Build the complete archive under a unique hidden/pending directory in `library/`: `song.opz`, immutable metadata snapshot, copied linked snippet, declared instrument payloads, and `manifest.json`.
3. Reread every declared payload. Require exact source/archive project-buffer equality, successful `parseProject(archiveBuffer)`, and matching SHA-256/byte-length manifest entries before promoting the pending directory to an archive.
4. Only then mark the archive verified and permit the next operation. If verification fails, retain the source untouched and leave the failed staging artifact for diagnosis (or remove it only after reporting its path).
5. For restore/overwrite, fully validate the selected archive first, make and verify the automatic target-slot backup, then stage and reread the replacement project before its final rename/write. On the removable OP-Z filesystem, treat this as recoverable—not magically atomic—and keep the verified auto-backup.
6. For slot clearing, keep automatic clearing feature-gated until it passes the fixture suite and a sacrificial real-device run: delete the project in content mode, safely eject, wait for restart, remount, and verify the expected empty/free state plus a successful restore. Until then, archive then direct the user to the documented on-device clear action.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Transaction handling | Staging directory/file + reread + manifest + verified auto-backup | SQLite, WAL, journaling library, transaction framework | The only mutable state is a few local files. Staging plus the already-required recoverable backup has fewer failure modes and no new runtime. |
| Integrity | Exact `Buffer` equality + parser validation + SHA-256 manifest | MD5-only identity | Existing short MD5 remains suitable for metadata lookup, but it is not sufficient verification evidence for a safety promise. |
| File writes | Native `fs` staging/flush/reread | `fs-extra`, `write-file-atomic`, archive/zip package | Node already supplies the required primitives. Dependencies add upgrade and behavior surface without solving OP-Z device semantics. |
| Tests | `node:test` and `node:assert/strict` with copied fixtures | Jest, Vitest, Playwright | The milestone needs deterministic filesystem and parser checks, not browser-framework tooling. |
| Clearing behavior | Hardware-validated project-file removal with on-device fallback | A crafted/guessed empty `.opz` template | Official docs allow project removal but do not define the resulting slot file/state. A guessed binary template is a format-corruption risk. |
| Split restoration | Reuse parser offsets and blank-pattern fixtures, then verify generated halves like any other archive | New OP-Z-format package or reverse-engineering rewrite | The project already owns the relevant parser and known pattern geometry; add only the small synthesis boundary plus tests. |

## Installation

No npm packages are required.

```bash
# Require a maintained Node LTS with fs write flushing and the stable built-in test runner.
node --version

# Run the new fixture tests once they are added.
node --test test/*.test.js
```

## What Not to Add

- No `package.json` merely to run tests; `node --test` works directly.
- No database, background sync service, file watcher, queue, or generic transaction abstraction.
- No binary-format dependency and no hand-authored empty-project template.
- No automatic device clearing until the explicit real-hardware acceptance test has passed and is recorded.

## Sources

- [Node.js releases — v24.19.0 is the latest LTS at research time](https://nodejs.org/en/blog/release) — MEDIUM (official, current)
- [Node.js filesystem documentation](https://nodejs.org/api/fs.html) — MEDIUM (official; `copyFileSync` non-atomicity and `writeFileSync` flush)
- [Node.js crypto documentation](https://nodejs.org/api/crypto.html) — MEDIUM (official; SHA-256 hashing)
- [Node.js test runner](https://nodejs.org/api/test.html) and [strict assertions](https://nodejs.org/api/assert.html) — MEDIUM (official)
- [Teenage Engineering OP-Z content/disk modes](https://teenage.engineering/guides/op-z/disk-modes) — MEDIUM (official; project add/modify/remove and safe-eject synchronization)
- [Teenage Engineering OP-Z project guide](https://teenage.engineering/guides/op-z/project) — MEDIUM (official; on-device clear-project action)
