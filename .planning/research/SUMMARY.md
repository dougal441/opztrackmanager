# Project Research Summary

**Project:** OP-Z Manager
**Domain:** Local, safety-first OP-Z Content-Mode librarian
**Researched:** 2026-08-20
**Confidence:** MEDIUM

## Executive Summary

OP-Z Manager is a personal macOS librarian whose central promise is that a musician can free one of the OP-Z's ten project slots without losing a recoverable song. The correct implementation is not a larger backup system: retain the existing dependency-free Node server, browser UI, filesystem bundles, and binary parser, but make every archive and overwrite flow a verified transaction. Capture a project once, stage a self-describing bundle, reread and byte-compare it, reparse the stored project, verify its declared payloads, publish it, and only then permit a destructive follow-up.

The milestone should deliver a first-class archive shelf and guarded restore before it attempts automatic slot freeing. An archive needs immutable metadata, a copied snippet when available, and whole-grid sample-pack context with honest disclosure; opaque pack identities make guessed per-song pack restoration unsafe. Restores require explicit target selection, a verified automatic backup of that target, and post-write verification. Keep the architecture small: one transaction boundary in `server.js`, format manipulation beside `parseProject()` in `parser.js`, and explicit confirmation/evidence in the current single-page UI.

The decisive risks are hardware semantics, not web or storage complexity. A mount must never fall back mid-transaction to `opzdisk/`; a USB copy is not device acceptance; deleting a project or generating split `.opz` bytes cannot be presumed firmware-safe. Ship verified archive plus manual on-device clearing until a sacrificial-device eject/reconnect/rejection/restore matrix proves an automatic clear method. Likewise, split detection may propose evidence and record user intent now, but independently restorable synthesized halves must remain experimental until fixture and hardware validation pass.

## Key Findings

### Recommended Stack

Keep the existing no-dependency CommonJS server, `app/index.html`, `parser.js`, library directory bundles, and mounted-OP-Z/local-fixture model. Node 24 LTS is preferred (minimum Node 20.10 for flushed `writeFileSync`); use only built-ins: `node:fs` for sibling staging and promotion, `node:crypto` SHA-256 for durable manifest evidence, and `node:test`/`node:assert/strict` for fixture safety checks. Do not add a database, transaction framework, binary-format dependency, frontend framework, or package installation.

**Core technologies:**

- **Node.js 24 LTS (minimum 20.10):** local archive and restore workflow — has all required filesystem durability and test primitives.
- **Existing CommonJS `server.js`:** transaction routes and shared safety boundary — avoids a needless architectural rewrite.
- **Existing `parser.js`:** structural verification and tightly scoped split synthesis — owns known OP-Z fixed-offset format knowledge.
- **Filesystem bundles + versioned JSON manifest:** portable archive records — directly inspectable and sufficient for one local user.
- **`node:crypto` SHA-256 + exact `Buffer` comparison:** persistent integrity evidence — checksum records proof; byte comparison and reparse make the live decision.
- **`node:test` on explicit `opzdisk/` fixtures:** safety regression coverage — prevents destructive automation from reaching a mounted device.

### Expected Features

The MVP is credible only if it makes backup evidence, recovery context, and destructive intent visible. Every verified archive becomes a searchable shelf item; a restore is always target-selected and target-protected; split analysis is advisory rather than editorial. Whole-grid context is the reliable milestone choice because `plugId` cannot safely identify every required pack.

**Must have (table stakes):**

- **Verified archive-and-free workflow** — capture once, stage, byte-compare, reparse, and retain source on any failure.
- **Self-describing archive bundle** — project bytes, metadata snapshot, verification manifest, instrument-grid manifest/copy, and copied or explicitly nonportable snippet status.
- **First-class archive shelf** — browse archives with origin, date, metadata, matrix, verification evidence, and snippet availability.
- **Restore to an explicit slot with verified automatic target backup** — no silent overwrite; project-only is the default restore scope.
- **Device-state guardrails** — transaction-scoped mount identity, disconnect stop, and safe-eject/reconnect status.
- **Explainable split review** — show chains, pattern ranges, and track evidence; let the user edit, name, confirm, or reject candidate halves.

**Should have (competitive):**

- **Verification receipt and intelligible failure state** — distinguish a verified archive from a retained source or recovery-required operation.
- **Restorable-context disclosure** — label grid, snippet, and unresolved instrument context rather than claiming blanket completeness.
- **Archive provenance and split-parent links** — preserve origin, selected patterns, and derivation identity across changed content hashes.
- **Side-by-side split review** — reuse the familiar step-matrix representation for musical confirmation.

**Defer (v2+ or hardware gate):**

- **Automatic slot clearing** — only after fixture and sacrificial-device acceptance prove the specific clear method.
- **Trusted independent split-half restore/freeing** — only after deterministic synthesis and firmware acceptance tests.
- **Per-pack automatic restoration, device-wide config snapshots, cloud/live MIDI features, setlists, history, and UI/server refactors** — none improve the immediate safety promise.

### Architecture Approach

Treat safety as a behavioural boundary, not a new layer. A mutation captures one source descriptor (`root`, slot path, device flag, mount identity, original bytes) and never re-resolves it. `server.js` stages and verifies bundles, serializes mutations, validates inputs, and applies restore/clear steps. `parser.js` remains the only location for binary split synthesis. The UI requests explicit confirmation and renders evidence; it never decides split semantics or writes files. Only verified manifests appear in the shelf; staging, failed, and recovery artifacts stay outside normal selection.

**Major components:**

1. **Archive transaction in `server.js`** — capture source bytes, copy declared context into a unique staging bundle, verify all payloads, then publish.
2. **Mutation guard in `server.js`** — validate slots/bundle IDs, serialize destructive work, pin the source root, and halt safely on source change or mount loss.
3. **Versioned bundle schema and scanner** — expose archive/split kind, verification state, provenance, metadata, snippets, and instrument manifests to the shelf.
4. **Restore transaction** — revalidate archive, create verified target/grid backup, recheck target, replace, read back, and report recovery reference.
5. **Split detector and confirmation UI** — return evidence only; persist user-confirmed intent and names without rewriting original bytes.
6. **`parser.js` synthesis helper** — later creates a selected-pattern buffer, rewrites invalid chain references, reparses it, and sends it through the ordinary archive verifier.

### Critical Pitfalls

1. **Calling a copy an archive before proving it** — stage from one captured `Buffer`, reread, require exact bytes plus parse success and SHA-256/length manifest entries before any mutation.
2. **A disappearing OP-Z silently switching to `opzdisk/`** — resolve the source once per transaction; recheck that exact root and never fall back mid-operation.
3. **Assuming disk-file deletion creates a free OP-Z slot** — ship manual on-device clear after a verified archive until a sacrificial-device matrix proves automatic behavior.
4. **Equating a project file with the complete audible song** — preserve and disclose metadata, snippets, and whole-grid/unresolved context; default restores to project-only and make grid restore separately protected.
5. **Treating multi-file writes or parser success as atomic/device-valid** — model recovery states, retain verified pre-write backups, and distinguish disk-write verification from post-eject device acceptance.
6. **Synthesizing split halves from incomplete occupancy heuristics** — never auto-split; preserve the parent, require exact user membership, repair chain references, and hardware-test outputs.

## Implications for Roadmap

Based on the research, suggested phase structure:

### Phase 1: Verified Transaction Foundation

**Rationale:** Every archive, restore, swap, clear, and split artifact depends on one trustworthy primitive; retrofitting it afterward would leave unsafe sibling paths.

**Delivers:** Captured transaction source descriptor; strict route validation; one in-process mutation gate; staged bundle lifecycle (`staging`, `verified`, `failed`, `recovery`); manifest schema; Buffer/parse/SHA-256 verification; and fixture/failpoint tests.

**Addresses:** Verified archive evidence, source preservation, device-state guardrails, and target-protection prerequisites.

**Avoids:** Unverified copies, source fallback after disconnect, invalid destructive inputs, accidental device-targeted tests, and misleading atomicity claims.

### Phase 2: Verified Archive Shelf and Manual Archive-and-Free

**Rationale:** A visible, restorable archive is the first user-facing proof of safety; manual device clear provides the core value without unproven firmware behavior.

**Delivers:** Full-grid bundle capture, immutable metadata/snippet/context status, verified archive shelf, receipts, origin/provenance, and an archive-then-manual-clear flow.

**Addresses:** Archive-and-free, complete bundle, shelf browsing, context disclosure, and a conservative clearing fallback.

**Avoids:** Claiming a copied project is complete, auto-clearing based only on host filesystem behavior, and orphaned metadata after archive creation.

### Phase 3: Transactional Restore and Instrument Safeguards

**Rationale:** Restore is destructive to a scarce target slot and must inherit the archive contract before wider mutation features are introduced.

**Delivers:** Verified-archive eligibility, explicit target selection, verified automatic target backup, post-write project verification, recovery references, and separately backed-up high-friction grid restore.

**Addresses:** Restore-to-chosen-slot and automatic target protection.

**Avoids:** Silent overwrite, partial multi-file restore, unprotected instrument-grid overwrite, and success before device reconnect confirmation.

### Phase 4: Split Detection and Confirmed Intent

**Rationale:** The user can safely gain clarity about suspected two-song projects before any binary transformation is trusted.

**Delivers:** Read-only candidate detection from disjoint saved chains, pattern clusters, and track profiles; side-by-side evidence; editable groups/names; and stable parent/derivation metadata.

**Addresses:** Explainable split review, user confirmation, and archive provenance.

**Avoids:** Treating a musical heuristic as a decision and losing relationships when descendant hashes change.

### Phase 5: Split Synthesis and Hardware Acceptance

**Rationale:** Binary rewriting is the highest format risk and should be isolated after all archive/recovery primitives and human intent exist.

**Delivers:** Minimal parser-adjacent half synthesis, deterministic chain cleanup, reparse/retained-block fixture tests, experimental half archives, and a recorded sacrificial-device restore/eject/reconnect/playback matrix.

**Addresses:** Confirmed independent split-half archive and restore, subject to acceptance.

**Avoids:** Source mutation, cross-boundary chains, false confidence from parser success, and firmware rejection.

### Phase 6: Hardware-Gated Automatic Clearing

**Rationale:** Automatic freeing is only appropriate after a specific deletion/replacement strategy passes the real-device acceptance matrix.

**Delivers:** The proven clear mechanism, reconnect-based verification, safe failure/recovery messaging, and automatic slot freeing only where supported by recorded evidence.

**Addresses:** Automatic archive-and-free completion.

**Avoids:** Guessed empty templates and irreversible slot state based on unsupported assumptions.

### Phase Ordering Rationale

- Verification, stable source identity, and recoverable auto-backups are cross-cutting dependencies; build and test them once before user-visible destructive workflows.
- Archive shelf precedes restore and clear because it provides the verified artifact and context both workflows rely on.
- Manual clear is a complete, honest interim capability; it must not wait for uncertain hardware behavior.
- Split detection is read-only and user-confirmed, so it can proceed before synthesis. Synthesis and automatic clear remain separate hardware gates.

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 1:** Inspect all current mutation callers to ensure the shared transaction guard covers backup, restore, swap, clear, and sample-pack writes without regressions.
- **Phase 3:** Confirm the actual existing whole-grid restore behavior and decide the smallest recoverable batch protocol for it.
- **Phase 5:** Research/characterize real fixture pattern blocks and establish the device acceptance matrix; current parser validity is insufficient.
- **Phase 6:** Requires hands-on OP-Z firmware/device validation, not more desk research, before selecting a clear strategy.

Phases with standard patterns (skip research-phase):

- **Phase 2:** Native Node staging/manifest verification and shelf presentation are well-documented and constrained by the established codebase.
- **Phase 4:** A pure evidence-producing heuristic plus explicit confirmation is a standard, low-risk local UI pattern once parser outputs are inspected.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Primary Node and OP-Z documentation supports the chosen primitives; removable-device durability remains hardware-specific. |
| Features | HIGH | Scope and required safety behavior are strongly grounded in project requirements and existing-product fit; device outcome remains gated. |
| Architecture | HIGH | Direct codebase analysis supports extending the current route/helper/parser boundaries; synthesized format acceptance is separate. |
| Pitfalls | MEDIUM | Current code and fixtures demonstrate most risks, but delete/synthesis/reconnect behavior requires a sacrificial OP-Z test. |

**Overall confidence:** MEDIUM

### Gaps to Address

- **Automatic-clear semantics:** Test the exact operation on each supported firmware/device and record post-eject slot state, `rejected/` contents, and restore recovery before enabling it.
- **Synthesized-half firmware acceptance:** Characterize source-specific blank patterns, validate retained chains and musical behavior, and run the same reconnect/restore matrix before presenting halves as trusted.
- **Pack-level restoration:** Keep whole-grid capture and explicit disclosure until an authoritative mapping from project state to sample-pack files exists.
- **Metadata identity for derivatives:** Design stable archive/derivation IDs alongside content hashes so names, notes, snippets, and parent links remain discoverable after edits or synthesis.
- **Legacy library items:** Decide and test how old, unverified bundles remain browseable while being ineligible for safety-critical free/restore workflows.

## Sources

### Primary (HIGH confidence)

- Existing project evidence: `PROJECT.md`, `server.js`, `parser.js`, `HANDOVER.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONCERNS.md`, and `opzdisk/` fixtures — current behavior, scope, and format limitations.

### Secondary (MEDIUM confidence)

- [Teenage Engineering OP-Z disk modes](https://teenage.engineering/guides/op-z/disk-modes) — Content-Mode operations, safe-eject synchronization, and rejection behavior.
- [Teenage Engineering OP-Z project guide](https://teenage.engineering/guides/op-z/project) — project slots, saved-chain context, and on-device clearing.
- [Node.js filesystem documentation](https://nodejs.org/api/fs.html) — staged writes, flush support, and non-atomic copy/concurrency cautions.
- [Node.js crypto documentation](https://nodejs.org/api/crypto.html) and [test runner](https://nodejs.org/api/test.html) — SHA-256 and built-in fixture testing.
- [z-po-project format reference](https://github.com/lrk/z-po-project/wiki/Project-file-format) — useful format context, not proof of firmware acceptance.

### Tertiary (LOW confidence)

- No external source establishes the OP-Z's post-delete slot state or acceptance of locally synthesized project bytes; hardware validation is required.

---
*Research completed: 2026-08-20*
*Ready for roadmap: yes*
