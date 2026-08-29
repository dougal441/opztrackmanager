# Phase 2: Verified Archive Shelf & Manual Freeing - Research

**Researched:** 2026-08-26
**Domain:** Dependency-free archive manifests, stored-byte revalidation, browser-native archive shelf, and read-only manual OP-Z clearing guidance
**Confidence:** HIGH for in-repo architecture; MEDIUM for documented hardware interaction; LOW until post-clear device state is observed

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

<!-- DATA_A9F4C2D1_START -->
### Archive Completeness and Eligibility
- Keep project verification and safe-to-free eligibility distinct: a valid project-only archive is verified, but only a complete deep archive may unlock manual-free guidance.
- A complete archive includes the verified project, the captured whole sample-pack grid, a snapshot of song annotations, source/provenance facts, and explicit snippet portability status.
- If a linked snippet can be canonically resolved inside an allowed recording root, copy and verify it inside the archive; otherwise record `unlinked`, `missing`, or `unavailable` without pretending it is portable.
- Never infer required packs from unresolved OP-Z identifiers. Whole-grid capture is the only v1 basis for declaring instrument context portable.

### Versioned Manifest and Evidence
- Use one plain JSON manifest with an explicit schema version, creation time, source slot/kind, project evidence, metadata snapshot, snippet status/evidence, and sample-pack manifest.
- Store only archive-relative paths and sanitized public facts; never persist mounted absolute paths, credentials, or raw internal errors.
- Revalidate every included file from stored bytes before publication and again before reporting the archive as verified or safe to free.
- Unknown, malformed, incomplete, or evidence-mismatched manifests remain visible as diagnostics and are never restore- or free-eligible.

### First-Class Archive Shelf
- Add a top-level Archive Shelf view beside the existing Songs and Instruments views rather than expanding the small sidebar list.
- Default to newest first and show name, tags, step matrix, source slot/kind, creation time, snippet status, archive completeness, and verification status at a glance.
- Keep the default row compact; an expanded detail exposes the full evidence and portability breakdown without a separate page or framework.
- Keep failed, legacy, partial, and corrupt items in a clearly separate diagnostics section with no restore or manual-free action.

### Guided Manual Freeing
- Offer the manual-free checklist only from a currently verified, complete archive whose source slot is known and whose mounted source still matches the archived project identity.
- Revalidate the archive and source immediately before showing the checklist; never translate the checklist into a filesystem mutation in this phase.
- Source the physical OP-Z clearing sequence from official Teenage Engineering documentation during research, then present one short ordered checklist covering safe eject, on-device clearing, reconnecting in disk mode, and refreshing confirmation.
- If the mount disappears, source bytes change, or eligibility cannot be reconfirmed, stop and show recovery/reconnect guidance; the archive remains retained.
<!-- DATA_A9F4C2D1_END -->

### the agent's Discretion

<!-- DATA_4E8B71C3_START -->
- Exact manifest field names, shelf spacing, disclosure styling, and copy may follow existing conventions and the smallest browser-native implementation.
- Use existing parser output for the archived step matrix rather than storing duplicated presentation markup.
<!-- DATA_4E8B71C3_END -->

### Deferred Ideas (OUT OF SCOPE)

<!-- DATA_D6C39A52_START -->
- Actual restore controls and target-slot writes remain Phase 3.
- Automatic filesystem clearing and its hardware acceptance gate remain Phase 6.
- Per-song inferred sample-pack subsets, archive history, and descendant linking remain v2.
<!-- DATA_D6C39A52_END -->
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ARCH-03 | User's archive records project metadata, snippet portability, instrument-grid context, source slot, creation time, and verification evidence in a versioned manifest | Upgrade the existing `info.json` in the hidden draft into a strict versioned manifest; snapshot safe metadata, copy and verify a contained linked snippet when possible, retain the existing whole-grid file evidence, and publish only after revalidating every claimed included file. [VERIFIED: `.planning/REQUIREMENTS.md:12`; `server.js:581-627`; `02-CONTEXT.md:17-27`] |
| ARCH-05 | User can browse verified archives on a first-class shelf with name, tags, matrix, provenance, snippet availability, and verification status | Extend the existing scan result with current derived verification/completeness facts, add one `archive shelf` tab and one renderer using native disclosures, and reduce the Songs sidebar to counts plus a shelf link. [VERIFIED: `.planning/REQUIREMENTS.md:14`; `app/index.html:307-339,341-361,497-540`; `02-UI-SPEC.md:110-157`] |
| SAFE-04 | User can archive a verified song and follow a guided manual device-clear fallback while automatic clearing remains unproven | Add a read-only preflight/final-check path that revalidates the archive and mounted source, render the official physical checklist, keep all four physical steps checkbox-only, and preserve the archive for every confirmation outcome. Device UAT must establish the observable empty-slot representation before the app can say `confirmed empty`. [VERIFIED: `.planning/REQUIREMENTS.md:31`; `02-CONTEXT.md:35-39`; CITED: https://teenage.engineering/guides/op-z/project; CITED: https://teenage.engineering/guides/op-z/disk-modes] |
</phase_requirements>

## Summary

Phase 2 should be an in-place extension of the Phase 1 transaction, scanner, test, and UI seams. The smallest safe implementation changes only `server.js`, `app/index.html`, and `test/transaction.test.js`: make the existing `info.json` the versioned manifest, add optional contained snippet capture before the existing atomic rename, turn `scanLibrary()` into the sole current-evidence classifier, and render that classifier in one first-class Archive Shelf. No package, build step, database, schema framework, second renderer, or new transaction abstraction is warranted. [VERIFIED: `AGENTS.md:15-22,79-120`; `server.js:193-228,233-320,581-679`; `app/index.html:267-339,341-361,497-540`]

Verification and completeness must stay independent. A supported project-only record can be verified but not complete; a deep record is complete only when its project, metadata snapshot, whole-grid evidence, and allowed snippet state revalidate. Safe-to-free is a third, ephemeral result derived from current archive bytes plus the currently mounted OP-Z and matching source slot; it must never be stored as a manifest flag. [VERIFIED: `02-CONTEXT.md:17-27,35-39`; `02-UI-SPEC.md:128-149,169-178`]

The official OP-Z guide documents selecting projects with `project` plus value keys `1-0`, clearing the entire selected project with `project + stop + shift`, entering content mode by holding `track` while powering on, safe eject before USB disconnect, play-to-eject in boot mode, and waiting for synchronization/restart. It does **not** document whether a cleared slot removes `projectNN.opz`, emits a canonical empty file, or merely parses with no used patterns. Phase 2 therefore never enables the words `confirmed empty`; the later hardware-clearing acceptance phase must record the destructive observation before adding that classifier. Research itself did not touch the mounted device. [CITED: https://teenage.engineering/guides/op-z/project; CITED: https://teenage.engineering/guides/op-z/disk-modes; CITED: https://teenage.engineering/_img/6001818854fd930004c9a0ce_original.pdf; RESOLVED: Q2]

**Primary recommendation:** Extend the existing `info.json`/bundle transaction and `scanLibrary()` classifier, add a single read-only manual-free revalidation endpoint and native shelf renderer, and hardware-gate only the post-clear empty classifier—not the archive or checklist implementation. [VERIFIED: `02-CONTEXT.md:47-66`; `02-UI-SPEC.md:110-214`]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Manifest creation and archive publication | API / Backend | Database / Storage | The Node route owns trusted input validation and the filesystem draft/verify/rename transaction. [VERIFIED: `server.js:498-635,768-800`] |
| Stored-byte revalidation and diagnostic classification | API / Backend | Database / Storage | Shelf truth must be computed from current files, parser results, and hashes rather than UI state. [VERIFIED: `server.js:208-285,656-679`; `02-CONTEXT.md:23-27`] |
| Snippet containment and copying | API / Backend | Database / Storage | Only the server can canonicalize an annotation path against the allowed recording roots and verify copied bytes. [VERIFIED: `server.js:332-357,890-938`; `02-CONTEXT.md:17-21`] |
| Archive Shelf layout, disclosures, focus, and checklist state | Browser / Client | API / Backend | The browser renders server-owned evidence using the existing fetch/render/status loop and native controls. [VERIFIED: `app/index.html:267-339,341-361`; `02-UI-SPEC.md:110-157,180-214`] |
| Manual-free eligibility and final slot classification | API / Backend | Browser / Client | The server must re-read the archive and mounted slot; the browser only reveals instructions or presents the returned outcome. [VERIFIED: `02-CONTEXT.md:35-39`; `02-UI-SPEC.md:169-201`] |
| Physical project selection, clearing, eject, and reconnect | OP-Z hardware / User | Browser / Client | Phase 2 provides guidance only; it performs no device write or clear command. [VERIFIED: `02-CONTEXT.md:7-10,35-39`; CITED: https://teenage.engineering/guides/op-z/project; CITED: https://teenage.engineering/guides/op-z/disk-modes] |

## Project Constraints (from AGENTS.md)

- Preserve recovery before destructive work, consider a backup incomplete until stored bytes are checked and the stored `.opz` parses, and stop a multi-step mutation when the device source becomes invalid. [VERIFIED: `AGENTS.md:13-22`]
- Use CommonJS strict-mode JavaScript, Node built-ins, browser-native HTML/CSS/JavaScript, direct `node server.js` startup, and no dependency, build, transpile, bundle, or framework work. [VERIFIED: `AGENTS.md:30-69,85-93`]
- Continue mounted OP-Z disk-mode and `opzdisk/` fixture support, but never let a device-specific preflight or confirmation silently substitute the fallback. [VERIFIED: `AGENTS.md:18-21,65-69`; current fallback quoted below from `server.js:117-124`]

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

- Do not commit or expose op1.fun credentials from `data/settings.json`; manifests and diagnostics may contain only sanitized public facts and archive-relative paths. [VERIFIED: `AGENTS.md:21-22,57-63`; `02-CONTEXT.md:23-27`]
- Preserve two-space indentation, semicolons, single quotes, lower-camel-case functions/locals, uppercase constants, plain objects/arrays, relative CommonJS imports, and co-located browser markup/style/script. [VERIFIED: `AGENTS.md:77-120`]
- Keep focused helpers adjacent to their subsystem in `server.js`; do not introduce controller/service/repository layers or a second composition root. [VERIFIED: `AGENTS.md:111-120,147-169`]
- Surface expected failures as sanitized JSON plus visible browser status/toast guidance; keep normal operation quiet. [VERIFIED: `AGENTS.md:95-109`; `server.js:725-745,952-960`; `app/index.html:267-300`]
- Use the active GSD workflow for implementation edits. Local fixture tests precede hardware acceptance, and research/automation must not use Mac screen control. [VERIFIED: `AGENTS.md:210-223`; `02-CONTEXT.md:70-74`]

## Standard Stack

### Core

| Library/API | Version | Purpose | Why Standard |
|-------------|---------|---------|--------------|
| Node.js | 22.22.0 installed locally | Runtime and built-in test runner | It is the current project runtime and supplies all required primitives without installation. [VERIFIED: local `node --version`; CITED: https://nodejs.org/en/download/archive/v22.22.0] |
| `node:fs` | built into Node 22.22.0 | Canonical paths, file stats, unique drafts, flushed writes, rereads, and rename publication | Existing code already uses these operations; official docs define `readFileSync`, `realpathSync`, `mkdtempSync`, and `renameSync`. [VERIFIED: `server.js:7-14,193-228,513-626`; CITED: https://nodejs.org/download/release/v22.22.0/docs/api/fs.html] |
| `node:path` | built into Node 22.22.0 | Controlled path derivation and containment | Existing `resolveChild()` combines positive ID validation, `realpathSync`, `resolve`, and `relative`. [VERIFIED: `server.js:456-461,642-655`; CITED: https://nodejs.org/download/release/v22.22.0/docs/api/path.html] |
| `node:crypto` | built into Node 22.22.0 | SHA-256 project, snippet, sample-pack, and mounted-UAT file evidence | Existing `sha256()` is the accepted hashing seam; official Node docs support `createHash('sha256')`. [VERIFIED: verbatim `function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }` at `server.js:384`; CITED: https://nodejs.org/download/release/v22.22.0/docs/api/crypto.html#cryptocreatehashalgorithm-options] |
| Existing `parseProject()` | in-repo | Project parse gate and shelf matrix source | It returns tempo, chains, patterns, and used patterns, including the 8×16 `stepGrid`; it throws for undersized bytes. [VERIFIED: `parser.js:87-121`] |
| `node:test` + `node:assert/strict` | built into Node 22.22.0 | Filesystem, route, scanner, and static UI checks | The project already has one dependency-free integration suite; Node's test runner is stable. [VERIFIED: `test/transaction.test.js:1-20`; CITED: https://nodejs.org/api/test.html] |
| Browser-native DOM | current macOS browser | Tabs, `<details>`, checkboxes, focus, and live status | The approved UI contract explicitly requires native controls in the existing single HTML file. [VERIFIED: `02-UI-SPEC.md:12-28,110-157,205-214`] |

### Supporting

| Existing seam | Purpose | When to Use |
|---------------|---------|-------------|
| `archiveCapturedProject()` | Hidden staging, stored project reread/compare/parse, whole-grid copy, evidence write, source revalidation, and atomic publication | Extend this function; do not create a parallel archive writer. [VERIFIED: `server.js:581-635`] |
| `manifestMatches()` | Recompute archive-relative path, byte count, and SHA-256 evidence for a directory | Reuse for whole-grid source/stored checks and shelf revalidation; keep symlinks/non-files fail-closed. [VERIFIED: `server.js:208-228`] |
| `scanLibrary()` / `findBundle()` | Current bundle scan and strict lookup/revalidation | Consolidate manifest validation here so shelf and manual preflight consume one truth. [VERIFIED: `server.js:233-285,656-679`] |
| `scanRecordings()` and `/audio` containment | Existing recording root model and canonical child checks | Extract one shared read-only resolver; do not invent another recording-root list. [VERIFIED: root list quoted below from `server.js:333-355`; containment at `server.js:890-919`] |

```js
const roots = [
  path.join(MUSIC_DIR, 'OP-Z songs'),
  path.join(ROOT, 'bounces'),
  path.join(MUSIC_DIR, 'FlowStudio', 'Recordings'),
];
if (src && src.device) roots.push(path.join(src.root, 'bounces'));
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Versioning existing `info.json` | Add `manifest.json` and maintain compatibility readers | A second metadata file creates two sources of truth; `info.json` already controls scan and restore verification. [VERIFIED: `server.js:232-255,614-623,656-674`] |
| Focused plain-object validator | JSON Schema plus validator package | Violates the no-package rule and adds a generic schema layer for one manifest shape. [VERIFIED: `AGENTS.md:18,38-53`; `02-CONTEXT.md:23-27`] |
| One shared shelf renderer | Sidebar cards plus full shelf cards | Duplicates status/action rendering and risks eligibility drift; the UI contract explicitly replaces sidebar cards with counts/link. [VERIFIED: `02-UI-SPEC.md:110-126`] |
| Read-only server preflight | Browser comparison of `STATE` | Browser state can be stale and cannot securely re-read archive/source bytes. [VERIFIED: `02-CONTEXT.md:35-39`; `app/index.html:302-339`] |
| Manual hardware checklist | MIDI/SysEx/BLE or filesystem clear | Device control is out of scope and automatic clearing remains Phase 6. [VERIFIED: `.planning/REQUIREMENTS.md:67-75`; `02-CONTEXT.md:78-83`] |

**Installation:** None. Do not add `package.json`, a lockfile, a package install, or a build command. [VERIFIED: `AGENTS.md:18,38-53`]

## Package Legitimacy Audit

Not applicable. This phase installs no external package. [VERIFIED: `AGENTS.md:18,38-53`; `02-UI-SPEC.md:250-258`]

## Minimal Manifest Contract

Keep `info.json` as the single manifest filename. The following field names and schema number are the smallest recommended design and are proposed, not existing in-repo discrete values. [ASSUMED]

| Field | Required | Meaning / derivation |
|-------|----------|----------------------|
| `schemaVersion: 1` | yes | Exact supported format discriminator; reject other values to diagnostics. [ASSUMED] |
| `created` | yes | One ISO creation time generated during the transaction and used for newest-first ordering. [VERIFIED: existing field verbatim `created: new Date().toISOString()` at `server.js:617`; `02-CONTEXT.md:23-24`] |
| `source` | yes | Reuse sanitized public `device`, `label`, and `slot` provenance only. Do not persist filesystem identity or an opaque mount fingerprint: manual-free inspection captures the currently mounted source identity inside each request, compares exact slot content with archive evidence, and invalidates the result if that current source disappears or changes. Existing public shape is verbatim `return { device: source.device, label: source.label, slot: source.slot };`. [VERIFIED: `server.js:505-506,513-551`; RESOLVED: Q1] |
| `project` | yes | Archive-relative `song.opz`, full SHA-256, byte count, and checked time. Existing bundle/evidence values are verbatim `song.opz` and `{ verified: true, sha256: sha256(stored), bytes: stored.length, checked: new Date().toISOString() }`. [VERIFIED: `server.js:232,586,613`] |
| `metadata` | yes | Snapshot only safe annotation fields needed by shelf/restore context: `name`, `tags`, `notes`, and `kit`; do not copy `wav`, `wavRoot`, `wavMatch`, or `updated` into this object because snippet/provenance own those concerns. Accepted metadata keys are quoted verbatim in `const limits = { name: 120, tags: 1000, notes: 10000, wav: 2000, wavRoot: 6, wavMatch: 40 };` plus `kit`. [VERIFIED: `server.js:479-496`; ASSUMED: minimal snapshot subset] |
| `snippet` | yes | One of the locked statuses `included`, `unlinked`, `missing`, or `unavailable`; only `included` carries an archive-relative path, SHA-256, and bytes. [VERIFIED: exact values quoted in `02-CONTEXT.md:20`; ASSUMED: nested field names/location] |
| `samplepacks` | yes | Capture flag plus existing file evidence array. Evidence entry shape is verbatim `{ path: rel.split(path.sep).join('/'), bytes: buf.length, sha256: sha256(buf) }`. Counts, totals, and per-track counts should be derived during scan, not duplicated. [VERIFIED: `server.js:193-228`; ASSUMED: wrapper field name] |

Do not store a `verified`, `complete`, `eligible`, matrix markup, file count, byte total, or per-track count as authoritative manifest truth. A publication-time `verified` fact may remain for backward-compatible display, but every shelf scan and manual preflight must recompute the result from bytes and structure. [VERIFIED: `02-CONTEXT.md:23-27`; `02-UI-SPEC.md:142-149,169-178`]

## Architecture Patterns

### System Architecture Diagram

```text
Songs row: archive complete song
  -> existing POST JSON mutation boundary + global mutation guard
  -> resolve source once; capture source identity + slot project Buffer
  -> snapshot sanitized metadata for captured project hash
  -> hidden library/.partial-* draft
       -> write/reread/compare/parse song.opz
       -> copy whole samplepacks grid + verify source and stored manifests
       -> resolve selected snippet against shared allowed recording roots
            no link -------------------------> record unlinked
            missing/unreadable/escaped ------> record missing or unavailable
            contained regular media file ----> copy/reread/hash -> record included
       -> write/flush versioned info.json
       -> re-read manifest and every claimed included file
       -> revalidate pinned source
       -> rename once to visible library bundle
  -> refresh state

GET state / read-only archive scan
  -> supported manifest validator
  -> parse + hash stored project
  -> verify samplepack/snippet manifests
  -> derive verified / completeness / diagnostic reason
  -> parse archived project for matrix (no stored markup)
  -> Archive Shelf renderer
       verified records -> native details/summary
       legacy/partial/failed/corrupt/unsupported -> separate diagnostics

Prepare manual freeing
  -> read-only endpoint re-runs archive scan for one bundle
  -> require complete + mounted device + source identity + same slot SHA-256
  -> browser reveals official physical checklist only
  -> user ejects, selects, clears, reconnects OP-Z
  -> read-only refresh classifies current mounted slot
       mount absent -> unavailable
       SHA-256 unchanged -> archived song still present
       any absent/changed/no-pattern representation -> changed/unclassified stop
  -> archive is retained in every branch
```

The browser, localhost Node API, laptop library, and optional mounted OP-Z are the only boundaries. No external service is needed for Phase 2. [VERIFIED: `AGENTS.md:32-69,134-169`; `02-CONTEXT.md:47-66`]

### Recommended Project Structure

```text
server.js                  # extend archive transaction, manifest scan, read-only manual preflight/check
app/index.html             # add one Archive Shelf tab/view and inline checklist
test/
└── transaction.test.js    # extend existing Node integration/static-UI suite
```

[VERIFIED: existing locations `AGENTS.md:79-120,134-145`; `test/transaction.test.js:1-20`]

### Pattern 1: One revalidator owns shelf truth

**What:** Refactor the shared part of `scanLibrary()` and `findBundle()` into one focused bundle reader that validates the identifier/root, parses a strict supported manifest, rereads and parses `song.opz`, recomputes SHA-256/bytes, verifies every claimed pack/snippet file, and returns a sanitized plain object. Scanner and manual preflight both call it. [VERIFIED: current duplicated checks `server.js:233-285,656-679`; locked revalidation `02-CONTEXT.md:23-27,35-39`]

**When to use:** Every time a bundle is displayed as verified, considered complete, or used to reveal manual-free guidance. Do not cache this result across `/api/state` calls. [VERIFIED: `02-UI-SPEC.md:169-178`]

### Pattern 2: Shared recording resolver, then copy captured bytes

**What:** Extract the canonical containment logic already used by `/audio` into a helper accepting the stored `wavRoot`/`wav` annotation and the captured source. It must resolve only the existing allowed roots, require a regular supported media file, read one source buffer, write that buffer into the draft, reread it, compare exact bytes, hash it, and record only the archive-relative destination. [VERIFIED: `server.js:332-357,890-938`; `02-CONTEXT.md:17-27`]

**When to use:** During archive capture after the project and metadata snapshot are pinned, before manifest publication. A linked file that cannot pass containment is evidence of `unavailable`, never permission to widen the roots. [VERIFIED: exact status quoted in `02-CONTEXT.md:20`; CITED: https://cornucopia.owasp.org/taxonomy/asvs-5.0/05-file-handling/03-file-storage]

### Pattern 3: Derived three-level status

**What:** Return three independent facts: stored-byte verification, portability completeness, and current manual-free eligibility. Use these exact locked portability statuses: `included`, `unlinked`, `missing`, `unavailable`. A valid `missing`/`unavailable` manifest can remain project-verified but incomplete; corruption of any file claimed as included makes the record unverified/diagnostic. [VERIFIED: `02-CONTEXT.md:17-27`; `02-UI-SPEC.md:128-149,169-178`]

**When to use:** Scanner API responses and shelf badges. Never collapse them into a single `safe` flag. [VERIFIED: `02-UI-SPEC.md:128-140`]

### Pattern 4: One read-only manual-free endpoint

**What:** Use one GET/read-only endpoint for both preflight and post-reconnect refresh. Given a positively validated bundle ID, it reruns the bundle reader and inspects the mounted OP-Z directly without `getSource()` fallback. Before the checklist it returns eligible only for a complete archive and exact current source-slot identity; after reconnect the same response contains the current slot relation. GET must never call a filesystem write, `withMutation()`, or a device-mutating helper. [VERIFIED: fallback risk `server.js:117-124`; validation/containment `server.js:436-461,642-655`; `02-CONTEXT.md:35-39,62-66`]

**When to use:** `prepare manual freeing` and `refresh and verify slot`. Keep `POST /api/clear-slot` unavailable for Phase 6; if the existing route name is reused, only its GET form may return instructions/evidence. [VERIFIED: current POST fence values quoted verbatim `'/api/clear-slot': 'Automatic clearing remains disabled until Phase 6 hardware validation.'` at `server.js:40`; `02-CONTEXT.md:62-66`]

### Pattern 5: Native shelf, one renderer

**What:** Add the third tab/view to the current `setTab()`/`render()` loop, render one native `<details><summary>` per item, reuse `matrixSvg()` with parsed archived patterns, and replace the sidebar archive cards with verified/diagnostic counts plus one link. Follow the approved tab semantics, focus transitions, live announcements, reduced-motion rule, and exact copy. [VERIFIED: `app/index.html:302-361,497-540`; `02-UI-SPEC.md:110-157,205-230`]

**When to use:** Initial loading, refreshed data, archive success, preflight, and final confirmation. Do not build a router or page framework. [VERIFIED: `02-UI-SPEC.md:12-28,110-126`]

### Official Manual Sequence: Documented vs UAT

| Step | What official documentation establishes | What remains inference / UAT |
|------|------------------------------------------|------------------------------|
| Safe eject | Always safely eject before disconnecting/unplugging USB; play can eject while in boot mode; wait for content synchronization and restart. [CITED: https://teenage.engineering/guides/op-z/disk-modes] | The UI may call the state `content/boot mode`, but the official page uses both terms in adjacent instructions; verify the actual LED/mount transition during UAT. [ASSUMED] |
| Select project | Hold `project` and press value keys `1-0`. [CITED: https://teenage.engineering/guides/op-z/project] | Mapping app slot `10` to hardware value key `0` is the natural interpretation, but the exact 01–10 UI mapping must be checked on the device. [ASSUMED] |
| Clear entire project | Hold `project`, `stop`, and `shift`. [CITED: https://teenage.engineering/guides/op-z/project] | The guide does not specify a progress bar, confirmation LED, duration, or disk representation for whole-project clear. Do not invent one. [CITED: https://teenage.engineering/guides/op-z/project] |
| Reconnect content mode | Hold `track` while powering on; all track LEDs are green; connect USB and the OP-Z appears as removable storage. [CITED: https://teenage.engineering/guides/op-z/disk-modes] | Mount timing varies; the UI should report mount unavailable until an actual device source is detected. [ASSUMED] |
| Confirm slot | Official docs call the gesture a clear of the entire project; the quick-start guide calls one factory-new project empty. [CITED: https://teenage.engineering/guides/op-z/project; CITED: https://teenage.engineering/_img/6001818854fd930004c9a0ce_original.pdf] | No official source located defines whether post-clear content mode has no file, a canonical empty `.opz`, or a parseable no-pattern project. A real manual-clear/remount observation is mandatory before `confirmed empty`. [CITED: https://teenage.engineering/guides/op-z/disk-modes; ASSUMED: classifier until UAT] |

### Anti-Patterns to Avoid

- **Storing `eligible: true`:** eligibility depends on current archive and mounted source bytes; derive it on every scan/preflight. [VERIFIED: `02-UI-SPEC.md:169-178`]
- **Calling `getSource()` for manual confirmation:** it can substitute `opzdisk/` after the OP-Z disappears. Resolve the mounted device only. [VERIFIED: `server.js:103-124`; `02-CONTEXT.md:35-39`]
- **Treating `usedPatterns.length === 0` as empty:** this has no official or current fixture proof and may misclassify a valid silent/default project. [VERIFIED: parser meaning `parser.js:87-118`; CITED: official guides above do not define disk representation]
- **Trusting manifest booleans/counts:** recompute hashes, parse, file lists, counts, totals, and completeness from current stored bytes. [VERIFIED: `02-CONTEXT.md:23-27`; current revalidation `server.js:208-228,233-255`]
- **Persisting selected recording source paths:** archive manifests may contain only archive-relative paths and sanitized public facts. [VERIFIED: `02-CONTEXT.md:23-27`]
- **Copying a symlink or non-regular recording:** canonicalize and require containment/regular-file status before reading. [VERIFIED: existing audio containment `server.js:890-919`; CITED: OWASP ASVS V5.3.2]
- **Making snippet failure abort all project archives:** record the locked non-portable status and keep the project archive verified but incomplete unless a claimed included copy fails verification. [VERIFIED: `02-CONTEXT.md:17-27`]
- **Two archive-card renderers:** sidebar becomes counts/link; shelf owns rows and actions. [VERIFIED: `02-UI-SPEC.md:110-126`]
- **Restore or automatic clearing controls:** both are explicitly later phases. [VERIFIED: `02-CONTEXT.md:78-83`]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Manifest framework | Generic schema engine or dependency | One strict plain-object validator for schema 1 | One format and no package/install constraint. [VERIFIED: `AGENTS.md:18,38-53`; `02-CONTEXT.md:23-27`] |
| Archive writer | New archive service/module | Extend `archiveCapturedProject()` | It already stages, verifies, retains failures, and renames once. [VERIFIED: `server.js:581-635`] |
| Directory/file evidence | Separate walker/checksummer | Reuse `copyDir()`/`manifestMatches()` | Existing evidence is archive-relative path, bytes, and SHA-256. [VERIFIED: `server.js:193-228`] |
| Recording root policy | New allowlist or browser path check | Extract resolver from `scanRecordings()` and `/audio` | One policy prevents shelf/archive/playback disagreement. [VERIFIED: `server.js:332-357,890-919`] |
| Matrix snapshot | Stored SVG/HTML or second parser | Existing `parseProject()` plus `matrixSvg()` | Presentation stays derived from archived bytes. [VERIFIED: `parser.js:87-121`; `app/index.html:341-361`; `02-CONTEXT.md:41-43`] |
| UI disclosure/stepper | Accordion or wizard package | `<details><summary>`, native checkboxes, existing tabs/status | Required by approved UI contract and accessible without dependencies. [VERIFIED: `02-UI-SPEC.md:110-214`] |
| Read-only workflow token | Session store or signed preflight token | Fresh server revalidation plus exact-slot acknowledgement | The operation is physical and current bytes are the authority; a token would become stale state. [VERIFIED: `02-CONTEXT.md:35-39`; `02-UI-SPEC.md:180-194`] |
| Empty project generator/comparator | Synthesized blank `.opz` or heuristic fingerprint | Hardware-observed post-clear fixture and the existing parser | Synthesizing projects is Phase 5 and empty representation is undocumented. [VERIFIED: `02-CONTEXT.md:78-83`; CITED: official OP-Z guides] |
| Test framework | Jest/Vitest/browser harness | Existing `node:test` integration/static HTML checks plus manual keyboard/device UAT | Existing suite is fast and dependency-free. [VERIFIED: `test/transaction.test.js:1-20`; local full run 0.73s; CITED: https://nodejs.org/api/test.html] |

**Key insight:** Phase 2 is mostly evidence shaping and presentation. The safe answer is one stricter manifest reader reused everywhere, not more layers. [VERIFIED: `02-CONTEXT.md:47-66`]

## Common Pitfalls

### Pitfall 1: Versioned manifest accepted structurally but not semantically
**What goes wrong:** A JSON object with plausible keys reaches the verified shelf even though paths, hashes, slots, dates, statuses, or nested arrays are malformed. **Why it happens:** `scanLibrary()` currently tolerates unreadable `info.json` as `{}` and checks only a few legacy fields. **How to avoid:** validate the complete supported shape before any eligibility calculation; sanitize the diagnostic reason. **Warning signs:** unknown schema versions or malformed evidence still render an action. [VERIFIED: `server.js:233-277`; `02-CONTEXT.md:23-27`]

### Pitfall 2: Included snippet escapes the recording roots
**What goes wrong:** A stored annotation or symlink causes archive capture to read an unrelated local file. **Why it happens:** `scanRecordings()` returns relative paths, but direct `path.resolve(base, rel)` without canonical-root containment is insufficient. **How to avoid:** reuse `/audio`'s `realpathSync` and allowed-root child test before reading; require a regular supported media file. **Warning signs:** the manifest contains a source path, `..`, an absolute path, or a file outside the four existing roots. [VERIFIED: `server.js:332-357,890-919`; CITED: https://cornucopia.owasp.org/taxonomy/asvs-5.0/05-file-handling/03-file-storage]

### Pitfall 3: Archive publication precedes final manifest verification
**What goes wrong:** a visible bundle contains a valid project but a truncated/mismatched manifest, pack, or snippet. **Why it happens:** Phase 1 verifies project/packs but currently writes `info.json` and renames without rereading the manifest itself. **How to avoid:** write/flush manifest, parse it back through the same validator, revalidate every included file, then run final source assertion and rename. **Warning signs:** any visible rename happens before the new manifest reader succeeds. [VERIFIED: current order `server.js:600-627`; locked rule `02-CONTEXT.md:23-27`]

### Pitfall 4: Legacy Phase 1 archives are silently upgraded
**What goes wrong:** old `info.json` records lack metadata/snippet/source schema evidence but are displayed as complete or safe. **How to avoid:** leave unversioned records unchanged and classify them `legacy` diagnostics; require a fresh complete archive for manual freeing. Diagnostic values are verbatim `legacy`, `partial`, `failed`, `corrupt`, and `unsupported`. [VERIFIED: `02-UI-SPEC.md:153-157`; current unversioned manifest `server.js:613-623`]

### Pitfall 5: Project-only versus partial ambiguity
**What goes wrong:** a valid intentionally project-only supported manifest is treated like malformed incomplete evidence. **How to avoid:** follow the locked context and detailed row contract: supported project-only can be verified with a `project only` badge and no manual-free action; reserve diagnostic `partial` for missing/malformed required evidence. Existing unversioned Phase 1 project-only bundles remain legacy diagnostics. [VERIFIED: `02-CONTEXT.md:17-18`; `02-UI-SPEC.md:128-140,153-157`]

### Pitfall 6: Source fallback during manual-free checks
**What goes wrong:** after eject, `getSource()` returns the local fixture and a final check reports the wrong slot state. **How to avoid:** device-only resolver for manual preflight/final confirmation, with explicit mount-unavailable result. **Warning signs:** manual-free call graphs contain `getSource()` without a `device === true` gate. [VERIFIED: `server.js:103-124`; `02-CONTEXT.md:35-39`]

### Pitfall 7: Empty-slot false positive
**What goes wrong:** the app declares success from file absence or no musical notes even though the hardware clear did not produce that exact state. **How to avoid:** Phase 2 returns changed/unclassified for every such representation; the later hardware-clearing acceptance captures before/after directory listing, project filename presence, bytes/hash, parser output, and remount behavior before encoding an observed rule and retained fixture. **Warning signs:** `confirmed empty` appears in Phase 2 runtime behavior or before a recorded device observation. [CITED: official guides do not define post-clear disk state; VERIFIED: hardware rule `AGENTS.md:17`; RESOLVED: Q2]

### Pitfall 8: Checklist becomes an app mutation
**What goes wrong:** checkbox changes or the final refresh call a POST route that writes/deletes device files. **How to avoid:** checkbox-only steps 1–4, one read-only revalidation call for step 5, and a test that snapshots every regular file beneath the mounted root before/after endpoint calls. **Warning signs:** `withMutation()`, `writeFileSync`, `renameSync`, `unlinkSync`, or `rmSync` is reachable from manual-free routes. [VERIFIED: `02-UI-SPEC.md:180-201`; `02-CONTEXT.md:35-39`]

### Pitfall 9: Unsafe HTML evidence rendering
**What goes wrong:** names, tags, paths, or diagnostic text inject markup into string-built rows. **How to avoid:** use existing `esc()` for text and `attr()` for attributes on every manifest-derived value; keep no raw internal errors. **Warning signs:** a manifest string is concatenated into `innerHTML` without one of those helpers. [VERIFIED: exact helpers at `app/index.html:291-292`; injection tests `test/transaction.test.js:601-628`; `02-UI-SPEC.md:95-106`]

## Code Examples

### Reuse existing stored-directory evidence comparison

```js
function manifestMatches(root, manifest) {
  if (!Array.isArray(manifest)) return false;
  const actual = [];
  const walk = (dir, relative = '') => {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith('.')) continue;
      const full = path.join(dir, f);
      const rel = path.join(relative, f);
      const st = fs.lstatSync(full);
      if (st.isDirectory()) walk(full, rel);
      else if (st.isFile()) {
        const buf = fs.readFileSync(full);
        actual.push({ path: rel.split(path.sep).join('/'), bytes: buf.length, sha256: sha256(buf) });
      } else throw new Error('unsupported archive entry');
    }
  };
  try { walk(root); }
  catch { return false; }
  const byPath = (a, b) => a.path.localeCompare(b.path);
  return JSON.stringify(actual.sort(byPath)) === JSON.stringify(manifest.slice().sort(byPath));
}
```

[VERIFIED: verbatim `server.js:208-228`] Preserve this fail-closed behavior; a later optimization is unnecessary for the current personal library. [VERIFIED: project scope `AGENTS.md:3-11`]

### Derive the matrix from archived bytes

```js
const stored = fs.readFileSync(projectPath);
const parsed = parseProject(stored);
// API returns parsed.patterns; browser passes the archive object to matrixSvg().
```

`fs.readFileSync`, `parseProject`, `patterns`, and `matrixSvg` are existing operations/values; the proposed local names/response wiring are [ASSUMED]. [VERIFIED: `server.js:246-264`; `parser.js:87-121`; `app/index.html:341-361`]

### Keep manual-free logic pure/read-only

```js
// Proposed shape; exact helper/response field names are [ASSUMED].
function inspectManualFree(bundleId) {
  const archive = readVerifiedBundle(bundleId);
  const device = findDeviceRoot();
  return deriveManualFreeState(archive, device);
}
```

The important verified constraints are that bundle IDs pass the existing positive validator/containment check, the mounted device is resolved without `opzdisk/`, and the helper performs no write. [VERIFIED: `server.js:103-124,456-461,642-655`; `02-CONTEXT.md:35-39,62-66`]

## State of the Art

| Old Approach | Current Phase 2 Approach | When Changed | Impact |
|--------------|--------------------------|--------------|--------|
| Unversioned `info.json` with project/packs evidence | Strict versioned `info.json` with metadata, snippet, source, project, and whole-grid evidence [ASSUMED: schema shape] | Phase 2 | Unknown/legacy records become visible diagnostics, not eligible shelf actions. [VERIFIED: `02-CONTEXT.md:23-33`] |
| Small Songs-sidebar library cards | One first-class Archive Shelf and a sidebar count/link | Phase 2 | One renderer owns evidence/action status. [VERIFIED: `02-UI-SPEC.md:110-157`] |
| Stored verification boolean plus partial recomputation | Full current-byte revalidation for every included file | Phase 2 | Tampering/corruption cannot remain reported verified. [VERIFIED: `02-CONTEXT.md:23-27`] |
| Fenced automatic clear route | Read-only manual checklist preflight/refresh; POST clear remains unavailable | Phase 2 until Phase 6 | User can free a slot physically without app device writes. [VERIFIED: `server.js:29-45`; `02-CONTEXT.md:35-39,78-83`] |
| Assumed empty slot from missing file/no notes | Hardware-observed empty classifier fixture | Phase 2 device UAT | Prevents a false success statement. [CITED: official docs do not specify filesystem representation] |

**Deprecated/outdated:**

- Unversioned Phase 1 `info.json` is not upgraded in place; display it as `legacy` diagnostic and create a new complete archive when manual freeing is needed. [VERIFIED: `server.js:613-623`; `02-CONTEXT.md:23-27`; `02-UI-SPEC.md:153-157`]
- Songs-sidebar restore selectors remain unavailable and should not be copied into the shelf; restore returns in Phase 3. [VERIFIED: `app/index.html:497-550`; `02-CONTEXT.md:78-83`]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Use `schemaVersion: 1` and the proposed nested field names inside existing `info.json`. | Minimal Manifest Contract | Planner may choose incompatible names; tests and scanner must agree before publication. |
| A2 | Snapshot `name`, `tags`, `notes`, and `kit` as metadata; represent the selected recording only through `snippet`. | Minimal Manifest Contract | A later restore might need another annotation; adding a backward-compatible optional field is cheap. |
| A3 | Do not persist an opaque mount fingerprint. Capture canonical root/dev/inode and project bytes only inside the current inspection request, compare archive provenance plus exact slot SHA-256/length, and revalidate the same captured source before responding. | Minimal Manifest Contract / Resolved Questions | RESOLVED: no remount-stability assumption enters the manifest or eligibility model. |
| A4 | Store an included snippet under one archive-relative `snippet/` location. | Minimal Manifest Contract | Exact filename/location may differ; no safety impact if scanner and manifest agree. |
| A5 | App slot 10 maps to hardware value key 0. | Official Manual Sequence | Wrong mapping risks clearing the wrong physical project; device UAT and exact-slot acknowledgement are mandatory. |
| A6 | Mount timing and the UI's `content/boot mode` wording match observed firmware behavior. | Official Manual Sequence | Guidance may confuse the user; adjust copy after device observation. |
| A7 | Proposed helper and API response field names in examples. | Code Examples | Implementation names may differ with no behavioral impact. |
| A8 | Missing file, canonical-empty bytes, and parseable no-pattern bytes are all unclassified in Phase 2. | Resolved Questions | RESOLVED: Phase 2 never reports confirmed empty; authoritative classification remains with the later hardware-clearing acceptance phase. |
| A9 | Future targeted tests will use names matching `manifest`, `snippet`, `shelf`, `manual free`, or `empty slot`. | Validation Architecture | Only the quick command changes if implementers choose different test names. |

## Resolved Questions

1. **[RESOLVED] What is the smallest stable mounted-device identity?**
   - Decision: persist no mount fingerprint and assume nothing about dev/inode stability across eject/remount. Each shelf eligibility/preflight/final-refresh request resolves the mounted OP-Z with `findDeviceRoot()` only, captures the current canonical root/dev/inode plus exact slot Buffer through the existing `captureSource()` seam, compares sanitized archive provenance (`device: true`, source label, slot) and project SHA-256/length, and calls `assertCapturedSource()` before returning. Any disappearance, replacement, or byte change invalidates that request; a later request starts with a fresh current-process identity. [VERIFIED: existing capture/revalidation `server.js:513-551`; SAFE-01 precedent]
   - Evidence: local substitution tests must change/remove the source between capture and final assertion; the mounted UAT snapshots every regular file beneath the mounted root before/after. No read-only remount evidence is needed because no identity is persisted across remount. [RESOLVED: fail-closed without an unproven persistence assumption]

2. **[RESOLVED] What exactly represents a cleared project on content disk?**
   - Decision: Phase 2 classifies missing project files, changed hashes, canonical-looking bytes, and parseable no-pattern projects as changed/unclassified stop outcomes. It never reports `confirmed empty` and performs no physical clear during UAT. The hardware-clearing phase owns the destructive observation, retained fixture, and authoritative empty classifier. [CITED: official guides do not define post-clear disk state; VERIFIED: phase boundary `02-CONTEXT.md:7-10,78-83`]

3. **[RESOLVED] Where should intentionally project-only supported manifests appear?**
   - Decision: honor locked context and the detailed shelf-row contract. Supported, internally consistent project-only manifests appear in the verified shelf with a visible `project only` badge and no manual-free action. Malformed/incomplete manifests and all unversioned Phase 1 bundles remain diagnostics. [VERIFIED: `02-CONTEXT.md:17-18`; `02-UI-SPEC.md:128-140,153-157`; locked CONTEXT precedence]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Server and tests | ✓ | 22.22.0 | None needed. [VERIFIED: local `node --version`] |
| `node:test` | Automated validation | ✓ | built into Node 22.22.0 | None needed. [VERIFIED: `test/transaction.test.js:1-20`; CITED: https://nodejs.org/api/test.html] |
| Modern macOS browser | Shelf/checklist UAT | ✓ by project environment, not screen-controlled during research | — | Static HTML assertions plus later manual keyboard UAT. [VERIFIED: `AGENTS.md:38-48`; `02-CONTEXT.md:73`] |
| Mounted OP-Z | Read-only archive/preflight whole-root non-mutation UAT | Stated available; deliberately not probed | firmware unknown | `opzdisk/` covers local archive/scanner tests but must never substitute manual-free device checks. Physical clearing/post-clear observation is excluded from Phase 2. [VERIFIED: `02-CONTEXT.md:73`; `server.js:117-124`; RESOLVED: Q2] |

**Missing dependencies with no fallback:** none for Phase 2 implementation or acceptance. `confirmed empty` is not a Phase 2 acceptance condition; it remains owned by the later hardware-clearing phase. [VERIFIED: environment probes and `02-CONTEXT.md:73`; RESOLVED: Q2]

**Missing dependencies with fallback:** none. [VERIFIED: no external package/service requirement]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` on 22.22.0 [VERIFIED: `test/transaction.test.js:1-20`; local version] |
| Config file | none [VERIFIED: `rg --files` found no package/test config] |
| Quick run command | `node --test --test-name-pattern='manifest|snippet|shelf|manual free|empty slot' test/transaction.test.js` [ASSUMED: future test names] |
| Full suite command | `node --test test/transaction.test.js` [VERIFIED: local run passed 30, skipped hardware 1, in 0.73s] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ARCH-03 | Versioned manifest snapshots metadata/source, classifies all snippet states, verifies whole grid and every included byte, rejects corruption/unknown schema/path escape | filesystem integration | `node --test --test-name-pattern='manifest|snippet' test/transaction.test.js` | ✅ extend existing |
| ARCH-05 | Scanner returns newest-first verified shelf plus separate sanitized diagnostics; archived parser output feeds matrix; UI has one accessible shelf renderer and no actions in diagnostics | integration + static UI | `node --test --test-name-pattern='shelf|diagnostic|matrix|tab' test/transaction.test.js` | ✅ extend existing |
| SAFE-04 | Preflight is read-only, device-only, fail-closed on mount/source/archive changes, and returns the four final relations without deleting archives | HTTP/filesystem integration | `node --test --test-name-pattern='manual free|empty slot|mount' test/transaction.test.js` | ✅ extend existing |
| SAFE-04 | Physical key/slot/eject/restart copy plus fail-closed handling for every undocumented post-clear representation | static UI + HTTP/filesystem integration | `node --test --test-name-pattern='manual free|manual checklist|mounted UAT' test/transaction.test.js` | ✅ existing file; no physical clear or human-only gate |

### Sampling Rate

- **Per task commit:** targeted `--test-name-pattern` command for the changed seam. [ASSUMED: future test names]
- **Per wave merge:** `node --test test/transaction.test.js`. [VERIFIED: current command]
- **Phase gate:** full suite green plus the opt-in mounted archive/preflight UAT proving every regular file beneath the mounted root retains the same relative path, size, mode, modification time, and SHA-256. Phase 2 performs no manual clear/remount observation; authoritative post-clear classification remains with the hardware-clearing phase. [VERIFIED: `AGENTS.md:17`; `02-CONTEXT.md:70-74`; RESOLVED: Q2]

### Wave 0 Gaps

- [ ] Add helper-level manifest/snippet/source fixtures inside existing `test/transaction.test.js`; no new test file or framework is needed. [VERIFIED: reusable `tempRoots()` at `test/transaction.test.js:22-37`]
- [ ] Add a device-UAT test/checkpoint gated by an explicit environment flag, following the existing skipped hardware test pattern. [VERIFIED: current gate verbatim `{ skip: process.env.OPZ_HARDWARE_UAT !== '1' }` at `test/transaction.test.js:801`]
- [x] Resolve the documentation gap fail-closed for Phase 2: never assert `confirmed empty`; the later hardware-clearing phase owns the destructive fixture/classifier. [CITED: official documentation gap; RESOLVED: Q2]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Personal loopback app has no account/authentication surface in this phase. [VERIFIED: `AGENTS.md:65-69`; server binds loopback at `server.js:964-975`] |
| V3 Session Management | no | No session or cookie state is introduced; do not add a preflight session/token store. [VERIFIED: current server/browser state `server.js:725-960`; `app/index.html:251-339`] |
| V4 Access Control | limited yes | Preserve loopback Host/Origin/custom-header controls for POST mutations; manual-free inspection remains read-only and returns sanitized facts. [VERIFIED: `server.js:403-435,725-735`] |
| V5 Input/File Validation | yes | Strict schema/identifier/status/type/length validation, trusted archive roots, canonical `realpath` containment, regular-file checks, and output escaping. [VERIFIED: `server.js:436-503,642-679,890-919`; CITED: https://cornucopia.owasp.org/taxonomy/asvs-5.0/05-file-handling/03-file-storage] |
| V6 Cryptography | yes for integrity evidence | Use existing built-in SHA-256; do not treat an unkeyed hash as authenticity or authorization. [VERIFIED: `server.js:384,513-534,600-613`; CITED: Node crypto docs] |

### Known Threat Patterns for Node/filesystem archive stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Manifest or included-file tampering | Tampering | Re-read, hash, byte-count, and parse current stored files before verified/complete/eligible output. [VERIFIED: `02-CONTEXT.md:23-27`] |
| Bundle/snippet path traversal or symlink escape | Tampering / Information Disclosure | Positive identifier validation plus canonical allowed-root containment; store archive-relative paths only. [VERIFIED: `server.js:456-461,642-655,890-919`; CITED: OWASP ASVS V5.3.2] |
| Wrong source or slot shown for physical clear | Spoofing | Current mounted-device identity, exact source-slot SHA-256, archive revalidation, visible song/slot/source, and acknowledgement checkbox. [VERIFIED: `02-CONTEXT.md:35-39`; `02-UI-SPEC.md:169-194`] |
| Local secret/path disclosure in shelf or diagnostics | Information Disclosure | Explicit public response projection, `esc()`/`attr()`, stable public codes, and no absolute/source paths or settings values in manifests. [VERIFIED: `server.js:505-506,565-579,952-960`; `app/index.html:291-292`; `02-CONTEXT.md:23-27`] |
| Browser/direct request turns guidance into a write | Elevation of Privilege / Tampering | Manual routes are GET/read-only; `POST /api/clear-slot` remains fenced until Phase 6. [VERIFIED: current fence `server.js:29-45,732-735`; `02-CONTEXT.md:62-66,78-83`] |
| Mount disappearance causes fixture substitution | Spoofing / Tampering | Device-only resolution for manual checks and explicit mount-unavailable outcome. [VERIFIED: fallback behavior `server.js:117-124`; `02-CONTEXT.md:35-39`] |

## What Not to Build

- No new package, `package.json`, build step, framework, component library, database, or schema engine. [VERIFIED: `AGENTS.md:18,38-53`; `02-UI-SPEC.md:12-28`]
- No new archive service/module, repository layer, background queue, watcher, cache, or persistent eligibility record. [VERIFIED: `AGENTS.md:111-120,147-169`; `02-UI-SPEC.md:169-178`]
- No second archive-card renderer, route framework, search, filter, pagination, or separate detail page. [VERIFIED: `02-UI-SPEC.md:110-157`]
- No restore, target-slot selector, instrument restore, automatic clear, filesystem delete/rename on OP-Z, MIDI/SysEx/BLE control, or synthesized blank project. [VERIFIED: `02-CONTEXT.md:7-10,78-83`; `.planning/REQUIREMENTS.md:67-75`]
- No inferred per-song sample-pack subset, archive history, or descendant graph. [VERIFIED: `02-CONTEXT.md:78-83`]
- No claim that missing file or zero used patterns means empty until device UAT proves it. [CITED: official documentation gap]

## Sources

### Primary in-repo (HIGH confidence)

- `server.js` — current transaction, manifests, source identity, library scan, recording roots, containment, routes, and public error boundary. [VERIFIED: file read this session]
- `parser.js` — parse gate and matrix-ready output. [VERIFIED: file read this session]
- `app/index.html` — current tabs, render loop, matrix, escaping, archive UI, live status, and mutation controls. [VERIFIED: file read this session]
- `test/transaction.test.js` — existing filesystem/HTTP/security/UAT patterns. [VERIFIED: file read this session]
- `02-CONTEXT.md`, `02-UI-SPEC.md`, `.planning/REQUIREMENTS.md`, and `AGENTS.md` — locked behavior, UI, requirement, and project constraints. [VERIFIED: files read this session]

### Official external (MEDIUM confidence from research seam)

- https://teenage.engineering/guides/op-z/project — project selection and whole-project clear control. [CITED]
- https://teenage.engineering/guides/op-z/disk-modes — content mode, USB mounting, safe eject, play-to-eject wording, synchronization/restart, and project file operations. [CITED]
- https://teenage.engineering/_img/6001818854fd930004c9a0ce_original.pdf — official quick-start reference that describes a factory-new project as empty. [CITED]
- https://nodejs.org/download/release/v22.22.0/docs/api/fs.html — built-in filesystem primitives. [CITED]
- https://nodejs.org/download/release/v22.22.0/docs/api/crypto.html — SHA-256 hashing API. [CITED]
- https://nodejs.org/api/test.html — stable built-in test runner. [CITED]
- https://cornucopia.owasp.org/taxonomy/asvs-5.0/05-file-handling/03-file-storage — trusted filenames, strict validation, and traversal prevention. [CITED]

### Tertiary (LOW confidence)

- None. Unverified design assumptions are isolated in the Assumptions Log and hardware UAT questions.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — installed runtime and all implementation seams are in-repo; no package selection. [VERIFIED: local probe and source reads]
- Architecture: HIGH — constrained to three existing files and locked Phase 1 patterns. [VERIFIED: `02-CONTEXT.md:47-66`; `AGENTS.md:111-120`]
- Manifest field names: MEDIUM — contents are locked, exact nesting/version is discretionary and proposed. [ASSUMED exact values]
- Official physical sequence: MEDIUM — directly documented by Teenage Engineering, but firmware/device behavior was not exercised. [CITED: official guides]
- Empty-slot confirmation: LOW until hardware UAT — no official filesystem representation was found and the mounted device was intentionally untouched. [CITED: official documentation gap; VERIFIED: `02-CONTEXT.md:73`]
- Pitfalls/security: HIGH for codebase paths and stored-byte threats; MEDIUM for ASVS mapping. [VERIFIED: source reads; CITED: OWASP]

**Research date:** 2026-08-26
**Valid until:** 2026-09-25 for codebase architecture; recheck official OP-Z guidance if firmware or guide content changes.
