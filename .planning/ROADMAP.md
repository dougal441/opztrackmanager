# Roadmap: OP-Z Manager

## Milestones

- ✅ **v1.0 Trustworthy Library** — Phases 1–6 (shipped 2026-08-29; [archive](milestones/v1.0-ROADMAP.md))
- 🚧 **v1.1 Unified Songs** — Phases 7–8

## Phases

<details>
<summary>✅ v1.0 Trustworthy Library (Phases 1–6) — SHIPPED 2026-08-29</summary>

- [x] Phase 1: Verified Transaction Foundation (3/3 plans)
- [x] Phase 2: Verified Archive Shelf & Manual Freeing (3/3 plans)
- [x] Phase 3: Guarded Restore & Instrument Recovery (3/3 plans)
- [x] Phase 4: Split Review & Confirmed Intent (1/1 plan)
- [x] Phase 5: Validated Split-Half Archives (1/1 plan)
- [x] Phase 6: Hardware-Gated Automatic Clearing (1/1 plan)

</details>

### 🚧 v1.1 Unified Songs

- [ ] **Phase 7: Dated Full-Device Archive** — Capture every occupied slot and the shared instrument grid as one verified, dated, read-only snapshot.
- [ ] **Phase 8: Unified Pattern-Level Songs** — Make device and shelf songs one collection, with pattern selection, archive/move, and verified restore.

## Phase Details

### Phase 7: Dated Full-Device Archive

**Goal:** One action preserves the current occupied device as a compact, verified, dated snapshot without changing it.
**Depends on:** Phase 6
**Requirements:** BULK-01, BULK-02, BULK-03, BULK-04
**Success criteria:**

1. The archive contains one manifest, every occupied project, and one shared whole-grid copy.
2. Every stored project has exact reread, parse, hash, and length evidence before publication.
3. Source loss or any failed member prevents a successful published snapshot.
4. UI reports the dated snapshot and per-slot outcomes.

### Phase 8: Unified Pattern-Level Songs

**Goal:** A song is a transferable pattern selection that can live on the device, on the archive shelf, or both.
**Depends on:** Phase 7
**Requirements:** SONG-01, SONG-02, SONG-03, SONG-04, SONG-05, SONG-06
**Success criteria:**

1. One song collection shows device and archive location state without conceptual duplicates.
2. Any non-empty pattern selection can be archived through the existing deterministic synthesis and verification path.
3. Moving a selection off-device preserves unselected patterns and never mutates before verified recovery exists.
4. Archived songs restore to a chosen slot through the proven recovery-first write path.
