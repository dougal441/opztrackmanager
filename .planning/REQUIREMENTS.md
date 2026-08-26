# Requirements: OP-Z Manager

**Defined:** 2026-08-24
**Core Value:** Dougal can free an OP-Z slot knowing the complete song can be verified and restored later.

## v1 Requirements

### Archive Safety

- [x] **ARCH-01**: User can start an archive from a slot whose source bytes and mounted-device identity are captured once for the entire operation
- [x] **ARCH-02**: User receives a verified archive only after the staged `song.opz` is reread, byte-compared with the captured source, reparsed successfully, and recorded with its SHA-256 and byte length
- [x] **ARCH-03**: User's archive records project metadata, snippet portability, instrument-grid context, source slot, creation time, and verification evidence in a versioned manifest
- [x] **ARCH-04**: User retains the source slot unchanged whenever archive capture or verification fails
- [ ] **ARCH-05**: User can browse verified archives on a first-class shelf with name, tags, matrix, provenance, snippet availability, and verification status

### Restore Safety

- [ ] **REST-01**: User must explicitly choose a restore target and can see its current song before confirming overwrite
- [ ] **REST-02**: User cannot overwrite a target until its current project has been captured as a verified automatic backup
- [ ] **REST-03**: User's selected archive is revalidated before restore and the written target is reread and byte-checked afterward
- [ ] **REST-04**: User receives a recovery reference and a non-success state if any restore step fails after mutation begins
- [ ] **REST-05**: User restores the project by default; whole-grid instrument restoration is a separate explicit action with its own verified pre-restore backup

### Device Safety

- [x] **SAFE-01**: User's destructive operation stops without switching to `opzdisk/` if the captured OP-Z mount disappears or changes during the transaction
- [x] **SAFE-02**: User cannot start destructive operations with invalid slot numbers, bundle identifiers, paths, or concurrent mutation requests
- [x] **SAFE-03**: User sees whether an operation targeted the mounted OP-Z or local fixture and receives the required eject, reconnect, and refresh guidance
- [x] **SAFE-04**: User can archive a verified song and follow a guided manual device-clear fallback while automatic clearing remains unproven

### Split Projects

- [ ] **SPLT-01**: User can see likely split projects identified from disjoint saved chains, separated pattern clusters, and track-profile evidence
- [ ] **SPLT-02**: User can inspect the evidence, edit pattern membership, name both halves, confirm the split, or reject the suggestion
- [ ] **SPLT-03**: User's confirmed split intent stores stable parent provenance and exact pattern membership without altering the original project
- [ ] **SPLT-04**: User can create independent half-project archives only through deterministic synthesis that preserves the parent, repairs invalid chain references, reparses successfully, and passes retained-pattern fixture checks
- [ ] **SPLT-05**: User can restore a synthesized half only after its format passes a recorded sacrificial-device eject, reconnect, rejection, playback, and recovery acceptance check

### Hardware-Gated Clearing

- [ ] **CLEAR-01**: User cannot enable automatic slot clearing until one specific clearing method passes local-fixture and sacrificial-device acceptance checks
- [ ] **CLEAR-02**: User can automatically archive and free a slot only when the archive is verified, the proven clear method is enabled, and post-reconnect device state confirms success
- [ ] **CLEAR-03**: User retains a verified recovery archive and receives explicit recovery instructions if automatic clearing cannot be confirmed

## v2 Requirements

### Restoration Refinements

- **REST-06**: User can restore only authoritative per-song sample packs without replacing the whole instrument grid
- **REST-07**: User can create and restore a separately labelled full-device configuration snapshot

### Library Intelligence

- **LIBR-01**: User can associate edited descendants with earlier song metadata through note-data fingerprints
- **LIBR-02**: User can browse version history for a song across device snapshots
- **LIBR-03**: User can automatically link new bounces using tempo and timestamp evidence

## Out of Scope

| Feature | Reason |
|---------|--------|
| Live-mode MIDI, SysEx, or BLE control | Does not improve disk-mode backup confidence |
| MIDI export, setlists, and drum-pack building | Useful later but unrelated to safely freeing slots |
| Cloud sync, accounts, or multi-user operation | This is a personal localhost macOS tool |
| Replacing the Node server or browser UI with frameworks | Existing dependency-free stack already supports the milestone |
| Guessing sample-pack dependencies from unresolved `plugId` values | Could produce a falsely complete restore |
| Automatic split decisions | Musical intent requires explicit user confirmation |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ARCH-01 | Phase 1 | Complete |
| ARCH-02 | Phase 1 | Complete |
| ARCH-03 | Phase 2 | Complete |
| ARCH-04 | Phase 1 | Complete |
| ARCH-05 | Phase 2 | Pending |
| REST-01 | Phase 3 | Pending |
| REST-02 | Phase 3 | Pending |
| REST-03 | Phase 3 | Pending |
| REST-04 | Phase 3 | Pending |
| REST-05 | Phase 3 | Pending |
| SAFE-01 | Phase 1 | Complete |
| SAFE-02 | Phase 1 | Complete |
| SAFE-03 | Phase 1 | Complete |
| SAFE-04 | Phase 2 | Complete |
| SPLT-01 | Phase 4 | Pending |
| SPLT-02 | Phase 4 | Pending |
| SPLT-03 | Phase 4 | Pending |
| SPLT-04 | Phase 5 | Pending |
| SPLT-05 | Phase 5 | Pending |
| CLEAR-01 | Phase 6 | Pending |
| CLEAR-02 | Phase 6 | Pending |
| CLEAR-03 | Phase 6 | Pending |

**Coverage:**

- v1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0

---
*Requirements defined: 2026-08-24*
*Last updated: 2026-08-24 after initial definition*
