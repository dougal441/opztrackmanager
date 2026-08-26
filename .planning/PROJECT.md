# OP-Z Manager

## What This Is

OP-Z Manager is a zero-configuration macOS librarian for Dougal's Teenage Engineering OP-Z. It shows and annotates the ten device project slots, previews songs, manages sample packs, and keeps an unlimited laptop library so a slot can be freed without losing the complete song.

The first milestone turns the existing backup features into a trustworthy archive-and-restore workflow and correctly handles projects that contain two songs split across different pattern ranges.

## Core Value

Dougal can free an OP-Z slot knowing the complete song can be verified and restored later.

## Requirements

### Validated

- ✓ User can see all ten project slots with tempo, patterns, chains, and a step-density matrix — existing
- ✓ User can name, tag, annotate, and link recordings to songs by project-content hash — existing
- ✓ User can preview sequenced patterns with WebAudio sketches and linked recordings — existing
- ✓ User can save and restore project bundles, including optional whole-grid sample-pack copies — existing
- ✓ User can swap project slots while the overwritten contents are automatically backed up — existing
- ✓ User can browse, audition, import, move, remove, and snapshot sample packs — existing
- ✓ User can work against a mounted OP-Z or a local `opzdisk/` fallback — existing
- ✓ User can create and inspect a versioned complete-song archive with verified project, metadata, snippet status, and whole-grid evidence — Phase 2
- ✓ User can browse verified archives in a first-class shelf and follow fail-closed, read-only manual-free guidance for an exact mounted slot — Phase 2

### Active

- [ ] User can browse archived songs as a first-class shelf and restore one into any chosen slot
- [ ] Existing target-slot contents are automatically backed up before restore or overwrite
- [ ] The app detects likely split projects from pattern and chain structure without deciding automatically
- [ ] User can confirm and name each half of a split project
- [ ] Each confirmed half can be archived and restored as an independent song after safe round-trip validation
- [ ] Slot-clearing behavior is verified on local fixtures and real hardware before the app performs it automatically

### Out of Scope

- Live-mode MIDI, SysEx, or BLE control — this milestone is limited to disk-mode backup confidence
- MIDI export, song history, bounce watching, setlists, and drum-pack building — useful later, but unrelated to safely freeing slots
- Cracking the proprietary sample-pack `plugId` hash — whole-grid or explicitly recorded pack placement covers this milestone
- Hosted, multi-user, or cross-platform operation — this is a personal localhost macOS tool
- Refactoring the single-file UI or splitting `server.js` into layers — change structure only where the safety workflow needs a testable boundary

## Context

The OP-Z has ten unnamed project slots. Dougal has more songs than slots and has previously squeezed two unrelated songs into separate halves of one project because clearing a slot did not feel safe. A stale manual spreadsheet did not solve the problem.

The existing app is functional and uses a no-dependency Node.js server, a single-file browser UI, filesystem-backed storage, an OP-Z binary parser, and an AIFF-to-WAV adapter. It already supports project bundles, deep whole-grid backups, restore, slot swap, recoverable instrument removal, metadata, snippets, and device/local source selection.

The current `/api/clear-slot` route backs up but does not clear. Safe clearing remains a hardware question: deleting a project file may let firmware regenerate an empty slot, or the app may need a verified empty-project template. Until tested on a sacrificial slot, manual device clearing remains the fallback.

Split detection can reuse existing parsed pattern occupancy, chains, track profiles, and step-grid data. Two disjoint saved chains are the strongest signal; separated pattern clusters and track-profile differences are supporting evidence. The user must confirm any split before the app treats it as two songs.

## Constraints

- **Safety**: Preserve automatic backup before every destructive operation; nothing the app does may make user data unrecoverable
- **Verification**: A backup is not complete until stored bytes are checked and the stored `.opz` parses successfully
- **Hardware**: Automatic slot clearing and synthesized split projects require real-device validation after local fixture tests
- **Stack**: Keep the no-dependency Node.js and browser-native architecture; add no build step or package install
- **Usability**: Double-click-and-go on macOS, with no developer setup beyond Node.js
- **Compatibility**: Current features operate in OP-Z disk mode and must still work against the `opzdisk/` fallback
- **Device writes**: Handle a disappearing mount safely and never continue a multi-step mutation after source validity is lost
- **Secrets**: Do not commit or expose op1.fun credentials from `data/settings.json`

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep the no-dependency Node server and single-file UI | It is proven, zero-config, and appropriate for a personal local tool | ✓ Good |
| Key metadata by project-content hash | Names and notes follow exact song bytes across slot moves and restores | ⚠ Revisit for edited descendants |
| Store library items as bundle directories | A song needs project bytes plus metadata and instrument context | ✓ Good |
| Back up before every destructive mutation | Recoverability is the product's central promise | ✓ Good |
| Treat archive verification as a product feature | Confidence requires evidence, not a successful copy call | ✓ Good — Phase 1 |
| Pin source identity and bytes for every mutation | A disappearing OP-Z must stop the transaction, never trigger fallback substitution | ✓ Good — Phase 1 |
| Publish archives only after atomic stored-byte verification | Hidden drafts and sanitized diagnostics preserve truthful recovery status | ✓ Good — Phase 1 |
| Keep project verification, archive completeness, restore eligibility, and manual-free eligibility separate | A valid project-only archive must never imply a complete recoverable song or safe physical clear | ✓ Good — Phase 2 |
| Recompute manual-free eligibility from current archive and mounted-slot bytes | Stored approval or `opzdisk/` fallback could guide clearing the wrong physical project | ✓ Good — Phase 2 |
| Leave every undocumented post-clear representation unclassified | Firmware behavior is not documented and Phase 2 performs no destructive hardware experiment | ✓ Good — Phase 2 |
| Require user confirmation for split detection | Pattern clustering is heuristic and must not silently reinterpret songs | — Pending |
| Validate clearing and synthesized projects on real hardware | Filesystem behavior and firmware acceptance cannot be assumed | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-26 after Phase 2*
