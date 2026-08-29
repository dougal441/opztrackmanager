# Requirements: OP-Z Manager v1.1

**Milestone:** v1.1 Unified Songs
**Defined:** 2026-08-29
**Core Value:** A song is a verified selection of patterns that can live on the OP-Z, on the archive shelf, or both.

## Dated Device Archives

- [ ] **BULK-01** — User can archive every occupied slot from the current device in one action.
- [ ] **BULK-02** — The operation creates one dated device snapshot with a manifest, verified project bytes for every occupied slot, and one verified whole-grid copy.
- [ ] **BULK-03** — The snapshot publishes only after every stored project rereads exactly, parses successfully, and the captured source identity remains valid; partial failures remain restore-ineligible.
- [ ] **BULK-04** — The result identifies the dated snapshot and the per-slot success or failure without changing any device bytes.

## Unified Pattern-Level Songs

- [ ] **SONG-01** — Device slots and archived songs appear as one song collection with a clear device/archive location state and no duplicate conceptual rows.
- [ ] **SONG-02** — User can choose any non-empty set of Pattern 1–16 from an occupied slot and archive it as a named song.
- [ ] **SONG-03** — A pattern-selected song stores exact source provenance, deterministic synthesized project bytes, metadata, and verification evidence using the hardware-accepted split-project format.
- [ ] **SONG-04** — User can move a whole slot or selected-pattern song off the device only after its archive is verified; unselected patterns remain on the device and an all-pattern move uses the proven clear path.
- [ ] **SONG-05** — User can restore an archived song to a chosen device slot through the existing recovery-first verified restore path.
- [ ] **SONG-06** — Destructive song moves remain source-pinned, serialized, recoverable, and reconnect-confirmed where the OP-Z requires it.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BULK-01 | Phase 7 | Pending |
| BULK-02 | Phase 7 | Pending |
| BULK-03 | Phase 7 | Pending |
| BULK-04 | Phase 7 | Pending |
| SONG-01 | Phase 8 | Pending |
| SONG-02 | Phase 8 | Pending |
| SONG-03 | Phase 8 | Pending |
| SONG-04 | Phase 8 | Pending |
| SONG-05 | Phase 8 | Pending |
| SONG-06 | Phase 8 | Pending |

## Out of Scope

- Merging an archived song into an already occupied target slot; v1.1 restores one verified song project to one chosen slot.
- Repacking selected patterns into different pattern numbers; original pattern positions are retained.
- A second library format or database; existing filesystem bundles and manifests remain authoritative.

---
*Last updated: 2026-08-29 after v1.1 requirements definition*
