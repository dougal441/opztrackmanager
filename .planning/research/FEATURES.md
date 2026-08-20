# Feature Landscape

**Domain:** Trustworthy OP-Z disk-mode archive, restore, and user-confirmed split-project handling
**Researched:** 2026-08-20
**Confidence:** HIGH for milestone scope and existing-product fit; MEDIUM for device lifecycle behavior until real-hardware validation

## Table Stakes

Features required for the archive-and-free promise to be credible. The OP-Z officially supports project and sample-pack backup, restore, modification, and removal in Content Mode; this milestone must make those low-level capabilities safe and intelligible rather than merely expose them. [MEDIUM: external documentation cross-checked with project evidence]

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Archive-and-free as one explicit workflow | The core user need is a free slot without a separate, error-prone series of backup and deletion actions. | Med | Snapshot the source once, create the archive, verify it, then offer/perform clearing only at the permitted safety gate. Preserve the source on every failure. [HIGH] |
| Verified archive status with specific evidence | “Copied” is not enough for a user deciding to discard the only on-device copy. | Med | Re-read `song.opz` from the bundle, parse it, and byte-compare it to the captured source. Show `Verified copy` with date, source slot, and what was checked; do not overclaim a device restore test. [HIGH] |
| Complete, self-describing archive bundle | A music project is only useful when its project bytes and restoration context travel together. | Med | Preserve project bytes, archive metadata, the existing instrument-grid snapshot/whole-grid copy option, and linked snippet reference or copied snippet when available. Surface unknown sample-pack identity instead of pretending it was resolved. [HIGH] |
| First-class archive shelf | Once a song leaves the device, it must remain as findable and auditionable as a device slot. | Med | Browse archives by name, tags, created date and origin; retain the matrix, metadata, verification status, and linked snippet. This replaces the current library-as-sidebar mental model. [HIGH] |
| Restore-to-chosen-slot with automatic target protection | Restoring must never turn the selected target into a new unprotected loss. | Med | Require a target selection and clearly identify its current contents; automatically archive those contents before overwrite, then verify the write where feasible. [HIGH] |
| Device-state guardrails | Content-mode writes are only valid while the same mounted source remains available and must be safely ejected for OP-Z to apply them. | Med | Show device versus local-fixture target, stop a multi-step mutation if the source disappears, and give a safe-eject/refresh next step. [HIGH for product need; MEDIUM for hardware outcome] |
| Conservative clearing gate with manual fallback | Clearing is the irreversible part of the workflow and the actual empty-slot filesystem behavior is still unproven. | High | Keep automatic clear disabled until fixture and sacrificial-device validation pass; after a verified archive, guide manual on-device clearing rather than invent an empty project. [HIGH] |
| Explainable split candidate review | A heuristic can identify suspicious structure, but only the musician knows whether two regions are two songs. | Med | Flag rather than decide; show chains, pattern ranges/gaps, and track-profile differences behind the proposal. Allow reject, edit pattern membership, name both halves, and store only an explicit confirmation. [HIGH] |
| Confirmed split halves as independent archive items | The user needs a split project to free capacity, not merely receive a warning. | High | After confirmation and safe synthesis validation, each half gets its own name, metadata/snippet/kit choices, archive row, and restore target. Preserve the original parent project as well. [HIGH requirement; MEDIUM technical confidence pending hardware test] |

## Differentiators

Features that materially improve confidence over raw drag-and-drop backup, without widening the milestone.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Verification receipt and failure explanation | Replaces a vague success toast with evidence the user can inspect before freeing a slot. | Low | Include capture time, source slot/hash, byte-match, parse result, and a failure state that explicitly says the source was retained. [HIGH] |
| Restorable-context disclosure | Makes the archive honest where OP-Z sample-pack identification is ambiguous. | Med | State whether restoration uses a complete grid snapshot, user-recorded pack choices, or unresolved context. The user can make an informed choice instead of discovering missing sound later. [HIGH] |
| Side-by-side split review | A divided step matrix plus chain/range evidence makes a heuristic review musically legible, not a numerical classification exercise. | Med | This reuses existing parser output and familiar song-row visual language. [HIGH] |
| Archive provenance and parent link | Lets a future restore explain where a song or split half came from. | Low | Record source slot, capture time, verification result, and for split halves the parent project/archive plus confirmed pattern set. It is not version history. [HIGH] |
| Per-pack restore as an explicit later refinement | Avoids unnecessary whole-grid disruption if the required packs can be recorded reliably. | High | Defer as an enhancement unless the milestone already has authoritative pack placement; the opaque `plugId` means it must never be guessed. [HIGH] |

## Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Clearing a slot after a successful filesystem copy alone | A copy call does not prove the stored bytes are intact or parseable, and device clearing remains unvalidated. | Gate clearing on stored-byte comparison and reparse; use manual on-device clearing until real-hardware behavior is proven. |
| Auto-accepting or auto-synthesizing a split from heuristic confidence | Disjoint patterns can be one composition; false splits silently change musical intent. | Present evidence and require editable user confirmation before creating half-song artifacts. |
| Pretending every archive has exact per-song sample-pack dependencies | The project format’s large `plugId` values are not reliably resolvable to pack files. | Preserve/offer declared grid context and disclose uncertainty; do not restore guessed packs. |
| Silent overwrite or target-slot selection by default | A restore is destructive to the target, particularly in a ten-slot device. | Require an explicit target and create an automatic target backup first. |
| Config/firmware cloning as part of per-song restore | `config/` is device-wide state, not song state; restoring it can produce unrelated changes. | Keep per-song archive scope to project and restoration context; consider a separately labeled full-device snapshot later. |
| Live MIDI/BLE control, cloud sync, setlists, MIDI export, version history, or UI/server refactors | They do not increase confidence in freeing a slot and would delay the safety boundary. | Keep the milestone disk-mode and filesystem-focused; extract only testable safety helpers when necessary. |

## Feature Dependencies

```text
Stable Content-Mode Source + archive naming/metadata
  → capture immutable project bytes + restoration context
  → re-read, parse, and byte-compare stored project
  → verified archive receipt and archive-shelf entry
  → (fixture + real-device clearing validation) automatic clear
  └→ (until validated) guided manual clear

Archive shelf + explicit target selection
  → automatic backup of current target
  → restore project/context
  → post-write verification and refresh

Parsed chains + pattern occupancy + track profiles
  → split candidate with evidence
  → user reviews, edits, names, and confirms halves
  → synthesize/select half-project bytes
  → fixture round-trip + real-device validation
  → independently verified half archives and restores
```

**Hard gates:** Do not make automatic clearing available before the regular archive path has passed its verification checks *and* clearing has passed local-fixture and sacrificial-device validation. Do not make synthesized half-project restore available before it has passed the same fixture/device validation. A confirmed split may still be archived as its intact parent project before that gate.

## MVP Recommendation

Prioritize:

1. A verified, complete archive bundle and a first-class archive shelf.
2. Restore-to-any-slot with automatic target backup, explicit target visibility, and device-disconnect safety.
3. Archive-and-free flow with the manual device-clear fallback while the automatic clear gate is unverified.
4. Explainable split detection and user confirmation, then independently archived halves only after synthesis validation.

Defer: per-pack automatic restore, full-device config snapshots, automatic clearing, and hardware-trusted split restoration until their real-device contracts are demonstrated. Do not defer the disclosure of those limits; it is part of backup confidence.

## Sources

- [Teenage Engineering — OP-Z disk modes](https://teenage.engineering/guides/op-z/disk-modes) — MEDIUM (current official device guidance; Content Mode permits project/sample-pack backup, restore, modification, and removal and requires safe ejection).
- [Teenage Engineering — OP-Z project guide](https://teenage.engineering/guides/op-z/project) — MEDIUM (current official project, snapshot, and clear behavior reference).
- [Ableton — Collect All and Save](https://help.ableton.com/hc/en-us/articles/209775645-Collect-All-and-Save) — MEDIUM (official example of collecting project dependencies and disclosing non-portable dependencies).
- [Veeam Backup Validator documentation](https://helpcenter.veeam.com/docs/vbr/userguide/backup_validator.html?ver=13) and [NIST backup-integrity test material](https://www.nist.gov/document/securitytestsuiteversion1-0pdf) — MEDIUM (cross-checked evidence for checksum/integrity validation before relying on backups).
- Project primary evidence: `PROJECT.md`, `HANDOVER.md` §§7–8, and `.planning/codebase/CONCERNS.md` — HIGH (scope, known format limits, safety constraints, and current implementation).
