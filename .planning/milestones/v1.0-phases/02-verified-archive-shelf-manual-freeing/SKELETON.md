# Walking Skeleton — OP-Z Manager Phase 2

**Phase:** 2
**Generated:** 2026-08-26

## Phase Goal

**As Dougal, I want to create and inspect a complete verified archive before following guided on-device manual clearing, so that I can free an OP-Z slot without losing the complete song.**

## Capability Proven End-to-End

Dougal can create one complete evidence-backed laptop archive, browse its current stored-byte proof in Archive Shelf, and reveal the official manual on-device clearing checklist only while the mounted source and exact slot still match—without OP-Z Manager writing to the device.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Runtime and framework | Existing CommonJS Node.js server and browser-native single page | Every required filesystem, HTTP, JSON, hashing, DOM, and test primitive already exists with no dependency or build step. |
| Archive record | Existing `info.json` upgraded to exact `schemaVersion: 1` | One manifest avoids competing sources of truth and gives later restore phases an explicit compatibility boundary. |
| Archive identity | Bundle directory identifier plus current stored-byte classification | Manual guidance is a transient derived state; it is not a second archive identity or persisted eligibility token. |
| Integrity | Existing `parseProject()`, `Buffer` equality, SHA-256/length, whole-grid manifests, and per-snippet evidence | Verification remains evidence from current stored bytes rather than filenames, stored booleans, or earlier success. |
| Snippet containment | Existing recording-root policy extracted from `scanRecordings()` and `/audio` | One canonical resolver prevents archive, playback, and shelf containment rules from drifting. |
| Shelf truth | One server classifier consumed by archive publication, `scanLibrary()`, `findBundle()`, and manual preflight | Verified, complete, diagnostic, and current eligibility outcomes cannot disagree between callers. |
| UI | One new Archive Shelf tab and one native `<details>` renderer in `app/index.html` | Existing tabs, render loop, matrix, status, escaping, and native controls cover the interaction without a router or component system. |
| Manual-free inspection | One GET/read-only endpoint using `findDeviceRoot()` plus request-local `captureSource()`/`assertCapturedSource()` | Safety-critical checks use fresh current-process root/dev/inode and exact slot bytes, cannot substitute `opzdisk/`, persist no mount fingerprint, and assume nothing about identity across remount. |
| Automatic clearing | Remains fenced | Phase 2 provides physical instructions only; filesystem clearing and its hardware acceptance belong to Phase 6. |
| Validation | Existing `node:test` suite plus opt-in direct mounted UAT | The smallest runnable evidence covers local fixtures, trust boundaries, browser contracts, and real-device non-mutation. |

## Stack Touched in Phase 2

- [ ] Existing archive route — complete metadata/grid/snippet manifest staged and verified before publication
- [ ] Existing library scanner — one strict supported-schema/current-byte classifier
- [ ] Existing state route — newest-first shelf plus separate sanitized diagnostics
- [ ] Existing browser UI — Archive Shelf tab, native disclosures, evidence, eligibility, and checklist
- [ ] Existing test runner — manifest, containment, XSS, fallback, action-absence, and whole-mounted-root regular-file non-mutation checks
- [ ] Local full-stack run — `NO_OPEN=1 node server.js`, with direct API/filesystem UAT against the mounted OP-Z

## Decision Traceability

`02-CONTEXT.md` accepted decisions do not carry identifiers, so this plan set assigns stable local trace IDs without changing their substance:

| ID | Accepted decision |
|---|---|
| D-01 | Keep project verification and safe-to-free eligibility distinct. |
| D-02 | Complete means verified project, whole sample-pack grid, annotation snapshot, provenance, and explicit snippet portability. |
| D-03 | Include a snippet only from a canonical allowed recording root; otherwise record `unlinked`, `missing`, or `unavailable`. |
| D-04 | Whole-grid capture is the only basis for portable instrument context; never infer pack subsets. |
| D-05 | Use one plain versioned JSON manifest with creation, source, project, metadata, snippet, and sample-pack evidence. |
| D-06 | Persist only archive-relative paths and sanitized public facts. |
| D-07 | Revalidate every included file before publication and every verified/eligible report. |
| D-08 | Unknown, malformed, incomplete, and evidence-mismatched records remain visible action-free diagnostics. |
| D-09 | Add Archive Shelf as a top-level view beside Songs and Instruments. |
| D-10 | Default newest-first and show name, tags, matrix, provenance, snippet, completeness, and verification at a glance. |
| D-11 | Keep rows compact and expose full evidence through an inline native disclosure. |
| D-12 | Keep failed, legacy, partial, and corrupt items in separate diagnostics with no restore/manual-free action. |
| D-13 | Offer the checklist only for a currently verified complete archive whose known mounted source and exact slot still match. |
| D-14 | Revalidate archive/source immediately before guidance and never translate guidance into a filesystem mutation. |
| D-15 | Use the official safe-eject, select, on-device clear, reconnect, and refresh sequence. |
| D-16 | Stop on mount loss/source change/failed eligibility and retain the archive with recovery guidance. |
| D-17 | Follow the smallest browser-native field, spacing, disclosure, and copy choices consistent with project conventions. |
| D-18 | Derive archived step matrices from existing parser output; do not store presentation markup. |

## Assumption-Delta Decision

**Primary noun:** archive record  
**Decision:** `no-change` — the detector matched “fallback,” but manual freeing is transient guidance computed from the same archive record, not a new identity model.

## Resolved Research Questions

- **Mounted identity:** Persist no filesystem identity or opaque fingerprint. Every shelf/preflight/refresh request freshly captures the mounted source through `findDeviceRoot()` + `captureSource()`, matches archive provenance/slot/SHA-256/length, and calls `assertCapturedSource()` before responding.
- **Cleared-slot representation:** Phase 2 reports every absent/changed/no-pattern state as changed/unclassified and never claims confirmed empty; Phase 6 owns destructive observation and authoritative classification.
- **Project-only placement:** Supported internally consistent project-only records remain in the verified shelf with a `project only` badge and no manual-free action; malformed/incomplete/legacy records remain diagnostics.

## Out of Scope (Deferred to Later Slices)

- Restore controls, target-slot selection, instrument recovery, and device writes (Phase 3)
- Split review/intent and synthesized split halves (Phases 4–5)
- Any automatic filesystem clearing or authoritative cleared-slot classifier (Phase 6 after hardware acceptance)
- Inferred per-song pack subsets, archive history, descendant linking, and bounce auto-linking (already recorded beyond this milestone)
- MIDI, SysEx, BLE, external service integration, packages, frameworks, build steps, search, filters, pagination, caches, queues, and session tokens

## Subsequent Slice Plan

- Phase 3: Restore a verified archive to an explicit target with a verified recovery capture.
- Phase 4: Review and confirm suspected split projects without changing originals.
- Phase 5: Produce independently restorable split halves only after deterministic and hardware checks.
- Phase 6: Enable automatic clearing only after one clearing method and post-clear representation pass fixture and sacrificial-device acceptance.

No external API integration is introduced. Teenage Engineering pages are documentation sources for fixed checklist copy, not runtime dependencies.
