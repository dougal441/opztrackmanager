# Domain Pitfalls

**Domain:** Trustworthy OP-Z Content-Mode archive/free-slot and user-confirmed split-project backup
**Researched:** 2026-08-20
**Confidence:** MEDIUM — filesystem/code facts are verified locally; Teenage Engineering documents the supported Content-Mode operations, but the post-delete and generated-project firmware behaviour needs hardware proof.

## Evidence Boundary

- **Verified code facts:** `server.js` currently copies archives and automatic target backups without reread/byte/parse verification; restore and swap write directly to project paths; `getSource()` re-detects a mounted device on every call and otherwise selects `opzdisk/`. `parser.js` only requires minimum length before interpreting fixed offsets, and its `usedPatterns` means patterns with musical notes, not every piece of project state.
- **Verified external facts:** OP-Z Content Mode supports project and sample-pack add/modify/remove. Changes are applied after safe eject, device synchronization, and restart; rejected content is reported in `rejected/` on the next Content-Mode entry. [MEDIUM — official documentation cross-checked]
- **Hardware assumptions, not product facts:** deleting `projectNN.opz` produces a usable empty slot; a locally synthesized `.opz` is firmware-accepted; same-directory rename is atomic enough on this removable filesystem; the current parser describes every state required for a complete song. Do not ship any of these as automatic behaviour before a sacrificial-device test.

## Critical Pitfalls

### Pitfall 1: Calling a copied file an archive before it is proven

**What goes wrong:** A copy may be short, stale, corrupt, or parseable only by accident, yet the source slot is cleared or later overwritten. The present `/api/backup` and `autoBackupSlot()` report success after `copyFileSync`; neither rereads nor validates the result.

**Why it happens:** Copy success is mistaken for persistence and semantic validity. A check against a fresh reread of the live source also has a time-of-check/time-of-use race if the source changes during the copy.

**Consequences:** The “Archive & free” promise becomes data loss, including when an automatic backup is made immediately before a restore.

**Prevention:** Read the source project once into a Buffer, calculate a strong digest and size, write that exact Buffer into a uniquely named staging bundle, close/flush where supported, reread the stored bytes, require exact byte equality/digest/size, then run `parseProject()` on the stored bytes. Persist a manifest containing digest, size, parser/version, original slot, operation ID, metadata snapshot, instrument-context declaration, and verification time. The source is eligible for a destructive step only after this manifest is durable. Apply the identical rule to the automatic backup of a restore target.

**Detection:** A bundle is `unverified` unless the manifest matches a successful reread and parse. Any mismatch, missing manifest, parser exception, or source fingerprint change aborts before mutation and leaves the source untouched.

**Roadmap phase:** **1 — Transaction and verified-bundle foundation.** Implement and fixture-test this primitive before exposing archive/free, shelf restore, or automatic overwrite.

### Pitfall 2: Device disappearance silently switching the transaction to `opzdisk/`

**What goes wrong:** `projFile()` calls `getSource()` independently. If the OP-Z disappears after an automatic backup but before a restore/clear write, subsequent resolution can select the local fallback. The user thinks the device changed while the fallback changed (or the request fails midway after a partial device mutation).

**Why it happens:** Source discovery is a read-time convenience today, not a transaction-scoped identity and availability contract.

**Consequences:** Wrong-target writes, a device slot left in an unknown state, and misleading success UI. This is more dangerous than a normal ENOENT because the fallback makes a different target valid.

**Prevention:** Resolve a source once at transaction start and retain its canonical root, `device` status, mount identity/fingerprint, and initial project hash. For a device mutation, require that exact root to still exist before every irreversible step; never downgrade an in-flight device request to fallback. Stage laptop archive work first; on disappearance, stop with `device-disconnected-after-safe-archive`, invalidate the UI source state, and require refresh/reconnect. Treat local-fixture writes as an explicitly selected test mode, not an automatic recovery route.

**Detection:** Compare transaction source identity/root, expected file existence, and source hash before each destructive step. Surface `ENODEV`, `ENOENT`, `EIO`, changed mount identity, or changed source hash as an interrupted transaction—not generic HTTP 500 or success.

**Roadmap phase:** **1 — Transaction and verified-bundle foundation**, with a mount-loss integration test that unmounts/renames a fixture between each transaction step.

### Pitfall 3: Clearing based on an untested theory of OP-Z disk behavior

**What goes wrong:** The app deletes `projectNN.opz` or writes a guessed empty template, expecting firmware to recreate an empty slot. Teenage Engineering confirms Content Mode can remove projects, but does not document the resulting on-disk project/slot state. The existing route deliberately backs up and tells the user to clear on-device.

**Why it happens:** Conflating “remove is supported” with a known, recoverable slot-freeing semantics; treating a locally parseable binary as firmware-valid.

**Consequences:** A missing, rejected, corrupted, or non-empty slot; a project that appears fine until eject/restart; irreversible loss if the archive gate was weak.

**Prevention:** Keep on-device `project + stop + shift` clear as the shipped fallback until a documented hardware acceptance matrix passes. Test one sacrificial slot per supported firmware/device: verified archive → removal or candidate write → safe eject → wait for sync/restart → reconnect Content Mode → inspect `projects/`, `rejected/`, and device UI → restore verified archive → repeat. Record firmware version, operation, hashes before/after, expected free-slot criterion, and recovery result. Prefer the proven device clear flow over a generated template; do not infer success from `fs.unlinkSync()` returning.

**Detection:** After every automatic clear, require a reconnect-based acceptance check, not merely a pre-eject reread: expected slot state on disk, no relevant rejection, and a deterministic restore round trip. If unavailable, label the archive verified but the slot **not freed**.

**Roadmap phase:** **2 — Hardware-gated archive/free workflow.** Its completion criterion is a real-device acceptance report; until then, it must offer only verified archive plus manual on-device clear instructions.

### Pitfall 4: Treating a project file as the complete audible song

**What goes wrong:** An `.opz` project is sequencer state, while sound context may live in sample packs and the useful recording snippet is currently a soft filesystem link. The project cannot reliably identify every non-factory pack from `plugId`; a whole-grid restore can overwrite unrelated device sounds.

**Why it happens:** “Deep backup” is conflated with per-song restoration, and link/path existence is mistaken for preserving a snippet.

**Consequences:** A restored sequence has wrong sounds, a missing recording, or restores 80 sample-pack positions the song never used. The archive shelf over-promises “complete restoration.”

**Prevention:** Make archive context explicit: include a copied snippet only when the user requests portability (otherwise record a checked link as nonportable); snapshot metadata into the bundle rather than relying only on mutable hash-keyed `meta.json`; record either (a) a complete grid snapshot or (b) user-confirmed per-pack assignments. On restore show the exact scope and default to project-only; make whole-grid restore a separate, high-friction, independently backed-up operation. Do not include `config/` in a per-song archive—its state is device-wide.

**Detection:** Verification reports `project: verified`, `metadata: present`, `snippet: copied / linked-present / missing`, and `instrument context: grid / assignments / unresolved`, rather than a single blanket “complete” badge. Before whole-grid mutation, verify a separate grid backup and compare the intended restore manifest.

**Roadmap phase:** **2 — Archive/free workflow** for the manifest and disclosure; **3 — Archive shelf and restore** for explicit restore scopes and target-grid protection.

### Pitfall 5: Partial multi-file writes and false atomicity

**What goes wrong:** Restore writes the project and can then recursively overwrite sample packs; swap writes slot A then slot B. An interruption can leave a half-swapped or partially restored device. Node exposes `fsyncSync`, but says device behavior is OS/device-specific; a normal local atomic-write recipe cannot prove OP-Z firmware acceptance.

**Why it happens:** Direct writes are short and convenient, and rename is assumed to provide a transaction across several files.

**Consequences:** Inconsistent slots, changed instrument grid, or a device requiring recovery even though the endpoint returned an error.

**Prevention:** Model each mutation as a journaled transaction: validate selected archive first; create and verify every affected automatic backup; stage one project file at a time in the same target directory; reread/compare it before final replacement where supported; record every intended and completed step. Never report success until target reread/parse verification passes. For multi-file sample-pack restoration, either make it an explicitly recoverable batch with a verified grid backup or defer it; do not call it atomic. Keep the recovery action (restore from the automatic bundle) in the result.

**Detection:** An incomplete journal, missing target, target digest mismatch, parser failure, disappearance, or unexpected `rejected/` entry produces a `recovery-required` state with the exact verified backup ID. Test failpoints after each write against `opzdisk/`.

**Roadmap phase:** **1 — Transaction foundation** for project replacement/swap; **3 — Restore and instrument-context safeguards** for multi-file restoration.

### Pitfall 6: Synthesizing a split song by erasing the wrong project state

**What goes wrong:** A split half is made by blanking the other patterns while retaining invalid chains or copying a “blank” pattern block from another project. Fixture inspection shows identical no-note blocks are not universal: unused-looking blocks have several different byte hashes. The parser’s `usedPatterns` is based on musical note counts, so it is not proof that all settings, control events, components, track state, or project-global state are absent.

**Why it happens:** Pattern occupancy is a useful heuristic, not a complete format model. A file that passes the current minimum-size parser can still lose audible behavior or be rejected by firmware.

**Consequences:** A synthesized half may contain a hidden dependency on the other half, lose automation/settings, reference blanked patterns from saved chains, or be accepted on disk but fail after OP-Z sync.

**Prevention:** Preserve the original parent project immutably and define a derived half as `{parent archive digest, selected patterns, selected chains, synthesis algorithm version, generated digest}`. Require user confirmation of the exact pattern and chain membership. Derive from a source-specific blank-pattern fixture only after byte-level characterization; rewrite/remove every chain reference outside the selected group; validate all chain indices and reparse the output. Do not promise independent restoration until a generated half has passed local fixture round trips **and** the sacrificial-device eject/reconnect/rejection/restore matrix. Keep “archive original split project” available even if extraction is deferred.

**Detection:** Preflight rejects overlapping or unassigned patterns, chains crossing the boundary, unknown format/firmware versions, and output whose parsed chains/selected patterns disagree with the confirmation. Regression fixtures must compare retained blocks byte-for-byte and assert that removed chains cannot reference removed patterns; hardware testing must confirm device load and restored musical behavior.

**Roadmap phase:** **4 — Split detection and confirmation** establishes only the metadata model and parent preservation. **5 — Split synthesis and hardware validation** owns binary rewriting; it must be separately gated from archive/free.

## Moderate Pitfalls

### Pitfall 1: A heuristic becomes an automatic editorial decision

**What goes wrong:** Disjoint pattern ranges or chains are read as two songs when they are an intro/outro, alternate arrangement, or unfinished material.

**Prevention:** Score and explain signals, default to one project, require explicit user naming/confirmation, and store the confirmation as a reversible annotation—not a rewrite. Strongest signal: disjoint saved chains; supporting signals: gaps, track-profile divergence, and step-density separation.

**Detection:** UI displays the exact chains and patterns supporting the suggestion; any overlap, one cross-group chain, or ambiguous group goes to “review,” not “split candidate.”

**Roadmap phase:** **4 — Split detection and confirmation.**

### Pitfall 2: Metadata follows a content hash but derivative files necessarily get new hashes

**What goes wrong:** Names, snippets, notes, and split links disappear after project edits, restore variants, or split synthesis because current metadata is keyed by the project-content hash.

**Prevention:** Store an archive-owned metadata snapshot plus stable archive/derivation IDs. Preserve `parentArchiveDigest` and selected-pattern provenance for every derived song; treat the content hash as integrity identity, not the only relationship key.

**Detection:** Restore/synthesis tests assert names, notes, snippet status, and parent/child links remain discoverable after each expected digest change.

**Roadmap phase:** **2 — Archive manifest** and **4 — Split metadata model.**

### Pitfall 3: Blind slot/input values widen a destructive path

**What goes wrong:** Mutation routes format `slot` directly into a filename, while callers supply body values. Invalid, duplicate, or missing slot values can create unexpected paths or make swap/restore behavior nonsensical.

**Prevention:** At the HTTP boundary require integer slots 1–10, distinct swap endpoints, known bundle IDs, explicit source mode, and exact operation confirmation. Resolve and containment-check all destination paths under the transaction source.

**Detection:** Small request tests cover absent, string, fractional, out-of-range, same-slot, and unknown-bundle inputs; no filesystem write may occur before validation succeeds.

**Roadmap phase:** **1 — Transaction and request-validation foundation.**

### Pitfall 4: Parser success is mistaken for format compatibility

**What goes wrong:** `parseProject()` proves only that a buffer reaches known offsets and contains interpretable fields. Its layout comments target firmware 1.1.x/1.2.x, while OP-Z device firmware and generated-byte acceptance are separate concerns.

**Prevention:** Version the verifier and make it a two-level result: `structurally parseable` versus `device-accepted` (only after the device acceptance matrix). Preserve original bytes before any experimental transformation.

**Detection:** Parser-version/firmware mismatch, unknown length/layout, or a device rejection disables automatic synthesis/clear and retains manual restoration.

**Roadmap phase:** **1 — Verified-bundle contract** and **5 — Hardware validation.**

## Minor Pitfalls

### Pitfall 1: Treating temporary files and backups as invisible implementation detail

**What goes wrong:** Staging directories, partial bundles, or auto-backups accumulate and are later selected as normal archives.

**Prevention:** Use operation IDs and explicit states (`staging`, `verified`, `recovery`, `failed`); scan only verified manifests as shelf items; keep failed material for diagnosis without marketing it as restorable.

**Roadmap phase:** **1 — Bundle lifecycle.**

### Pitfall 2: Confusing device acceptance with a successful USB copy

**What goes wrong:** The UI declares restore complete before safe eject, synchronization, restart, and a reconnect check. OP-Z explicitly defers applying changes until after eject and can place rejected content in `rejected/`.

**Prevention:** Use two statuses: `disk write verified` and `device acceptance pending/confirmed`; give the user the safe-eject instruction and a reconnect verification action.

**Roadmap phase:** **2 — Hardware-gated archive/free** and **5 — Synthesized-file acceptance.**

### Pitfall 3: Destructive test automation against the mounted OP-Z

**What goes wrong:** Fixture tests silently target `/Volumes` because automatic device detection wins over fallback selection.

**Prevention:** Make fixtures an explicit `OPZ_ROOT`/test transaction target and refuse automated destructive tests when `source.device` is true. Use real hardware only through a manual sacrificial-slot protocol.

**Roadmap phase:** **1 — Test harness and transaction guards.**

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| 1. Transaction, validation, verified bundles | Copy/backup marked successful before it is reread; device source re-resolves to fallback; invalid slot inputs write unexpected paths. | One transaction-scoped source identity; Buffer-to-bundle verification; manifest/journal states; strict request validation; failpoint tests on `opzdisk/`. |
| 2. Archive and free slot | File deletion/template behavior is assumed from generic Content-Mode support. | Gate automatic clear on a recorded sacrificial-device acceptance matrix; otherwise archive verified + manual on-device clear only. |
| 3. Archive shelf and restore | “Complete” restores lack snippet or sound context, or a whole-grid restore overwrites unrelated packs. | Bundle metadata/snippet/context status; project-only default; separately verified grid backup and high-friction whole-grid restore. |
| 4. Split detection and confirmation | A heuristic silently turns one arrangement into two songs; hash-keyed metadata is orphaned. | Explain score and require reversible confirmation; retain immutable parent archive; create stable archive/derivation identifiers. |
| 5. Split synthesis and real-device validation | Blank-pattern substitution loses non-note state or leaves cross-boundary chains; parser validity is confused with firmware acceptance. | Rewrite chains deterministically; fixture-level retained-block/chain tests; reparse and byte-manifest outputs; eject/reconnect/rejected/restore hardware matrix before enabling restore. |

## Sources

- [Teenage Engineering — OP-Z disk modes](https://teenage.engineering/guides/op-z/disk-modes) — MEDIUM, official current guidance; cross-checked with local project evidence.
- [Teenage Engineering — OP-Z project guide](https://teenage.engineering/guides/op-z/project) — MEDIUM, official current on-device project-clear and save behavior; it does not establish disk-file deletion semantics.
- [Node.js File System API](https://nodejs.org/api/fs.html) — MEDIUM, official current API; `fsyncSync` flush behavior remains OS/device-specific.
- Local verified evidence: `server.js`, `parser.js`, `HANDOVER.md`, `.planning/codebase/CONCERNS.md`, and real-format fixtures under `opzdisk/projects/` — HIGH for current implementation/fixture observations, not proof of OP-Z firmware acceptance.
