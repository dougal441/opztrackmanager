# Roadmap: OP-Z Manager

## Overview

This milestone turns the existing backup features into a safety-first archive-and-restore workflow: first make destructive transactions trustworthy, then let Dougal archive and manually free slots, restore safely, review split projects, and enable binary synthesis or automatic clearing only after their explicit hardware acceptance gates pass.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Verified Transaction Foundation** - Make every destructive workflow source-pinned, validated, serialized, and evidence-backed. (completed 2026-08-26)
- [ ] **Phase 2: Verified Archive Shelf & Manual Freeing** - Create complete archive records users can browse before following the safe manual clear fallback.
- [ ] **Phase 3: Guarded Restore & Instrument Recovery** - Restore into an explicitly chosen slot without unprotected overwrites.
- [ ] **Phase 4: Split Review & Confirmed Intent** - Surface suspected two-song projects for user-controlled review without changing originals.
- [ ] **Phase 5: Validated Split-Half Archives** - Produce independently restorable halves only after deterministic synthesis and recorded hardware acceptance.
- [ ] **Phase 6: Hardware-Gated Automatic Clearing** - Enable automatic slot freeing only for a clear method proven on fixtures and sacrificial hardware.

## Phase Details

### Phase 1: Verified Transaction Foundation

**Goal**: Users can start destructive archive and restore workflows knowing the app captures one source, validates intent, and preserves data unless verification succeeds.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: ARCH-01, ARCH-02, ARCH-04, SAFE-01, SAFE-02, SAFE-03
**Success Criteria** (what must be TRUE):

  1. User can begin an archive or restore operation whose source bytes and device identity stay fixed for the whole transaction, and the operation stops safely rather than switching to `opzdisk/` if that mounted source disappears or changes.
  2. User cannot start a destructive operation with an invalid slot, archive identifier, or path, or while another mutation is in progress.
  3. User can see whether an operation is targeting the mounted OP-Z or the local fixture and receives the required eject, reconnect, and refresh guidance.
  4. User receives a verified archive result only after the staged project is reread, byte-compared, reparsed, and recorded with SHA-256 and byte length; otherwise the source slot remains unchanged.

**Plans**: 3/3 plans executed

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Pin one source and publish an archive only after stored-byte verification

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Enforce shared request, path, source, and concurrency boundaries

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Surface operation safety and prove the mounted archive path

### Phase 2: Verified Archive Shelf & Manual Freeing

**Goal**: Users can create a complete verified archive, inspect it in a first-class shelf view, and safely free a slot through the guided manual-device fallback.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: ARCH-03, ARCH-05, SAFE-04
**Success Criteria** (what must be TRUE):

  1. User can inspect a verified archive record containing project data, song metadata, snippet portability status, instrument-grid context, source slot, creation time, and versioned verification evidence.
  2. User can browse a first-class archive shelf view with each verified song's name, tags, step matrix, provenance, snippet availability, and verification status.
  3. User can archive a verified song and follow explicit on-device manual-clear instructions while automatic clearing is still unproven.

**Plans**: 3 plans
**UI hint**: yes

Plans:

**Wave 1**

- [ ] 02-01-PLAN.md — Publish strict versioned manifests with verified snippet and whole-grid stored-byte evidence

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 02-02-PLAN.md — Render one newest-first first-class Archive Shelf from the shared server classifier

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 02-03-PLAN.md — Gate official manual-free guidance behind device-only read checks and prove mounted non-mutation

### Phase 3: Guarded Restore & Instrument Recovery

**Goal**: Users can restore a verified archive to a chosen slot without silently losing the slot's existing project or instrument grid.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: REST-01, REST-02, REST-03, REST-04, REST-05
**Success Criteria** (what must be TRUE):

  1. User must select a restore target in the restore interface and can view that slot's current song before confirming an overwrite.
  2. User cannot overwrite the selected target until its existing project has been captured as a verified automatic backup.
  3. User's archive is revalidated before restore, and the resulting target project is reread and byte-checked after the write.
  4. User receives a recovery reference and a non-success outcome whenever a restore failure occurs after mutation has started.
  5. User restores only the project by default; restoring the whole instrument grid is a separate explicit action protected by its own verified pre-restore backup.

**Plans**: TBD
**UI hint**: yes

### Phase 4: Split Review & Confirmed Intent

**Goal**: Users can use a split-review interface to examine likely two-song projects, decide their intended halves, and retain the original project unchanged.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: SPLT-01, SPLT-02, SPLT-03
**Success Criteria** (what must be TRUE):

  1. User can see likely split projects identified from disjoint saved chains, separated pattern clusters, and track-profile evidence without the app deciding that they are split.
  2. User can inspect the evidence, edit each half's pattern membership, name both halves, and either confirm or reject the suggestion.
  3. User's confirmed split stores stable parent provenance and exact membership while leaving the original project bytes unchanged.

**Plans**: TBD
**UI hint**: yes

### Phase 5: Validated Split-Half Archives

**Goal**: Users can archive a confirmed half as an independent song only when deterministic synthesis and the split-format hardware acceptance gate establish that it is safe to restore.
**Mode:** mvp
**Depends on**: Phase 3, Phase 4
**Requirements**: SPLT-04, SPLT-05
**Success Criteria** (what must be TRUE):

  1. User can create an independent archive for a confirmed half only when synthesis preserves its parent, retains exactly the selected patterns, repairs invalid chain references, and passes reparse plus retained-pattern fixture checks.
  2. User sees synthesized halves remain ineligible for restore until their format has a recorded sacrificial-device eject, reconnect, rejection, playback, and recovery acceptance result.
  3. User can restore a synthesized half as an independent song only after that recorded device acceptance check passes.

**Plans**: TBD

### Phase 6: Hardware-Gated Automatic Clearing

**Goal**: Users can automatically archive and free a slot only through a clearing method proven on fixtures and sacrificial OP-Z hardware, with a retained recovery path for any failed confirmation.
**Mode:** mvp
**Depends on**: Phase 1, Phase 2, Phase 3
**Requirements**: CLEAR-01, CLEAR-02, CLEAR-03
**Success Criteria** (what must be TRUE):

  1. User cannot enable automatic slot clearing until one specific clearing method has passed both local-fixture and sacrificial-device acceptance checks.
  2. User can automatically archive and free a slot only when its archive is verified, the proven clear method is enabled, and post-reconnect device state confirms success.
  3. User retains a verified recovery archive and receives explicit recovery instructions whenever automatic clearing cannot be confirmed.

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Verified Transaction Foundation | 3/3 | Complete    | 2026-08-26 |
| 2. Verified Archive Shelf & Manual Freeing | 0/TBD | Not started | - |
| 3. Guarded Restore & Instrument Recovery | 0/TBD | Not started | - |
| 4. Split Review & Confirmed Intent | 0/TBD | Not started | - |
| 5. Validated Split-Half Archives | 0/TBD | Not started | - |
| 6. Hardware-Gated Automatic Clearing | 0/TBD | Not started | - |
