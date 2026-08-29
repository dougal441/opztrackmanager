# Retrospective: OP-Z Manager

## Milestone: v1.0 — Trustworthy Library

**Shipped:** 2026-08-29
**Phases:** 6 | **Plans:** 12

### What Was Built

- Source-pinned, byte-verified complete-song archives and a first-class shelf.
- Recovery-first project and whole-grid restore to occupied or empty slots.
- User-confirmed pattern splits with deterministic, hardware-accepted half archives.
- Hardware-gated automatic clearing with persisted reconnect confirmation.

### What Worked

- Keeping one mutation guard and one stored-byte classifier made safety fixes apply everywhere.
- Direct filesystem UAT separated proven OP-Z behavior from fixture assumptions.
- Exact pre-write backups and post-write rereads made every sacrificial test recoverable.

### What Was Inefficient

- Hardware reconnect steps required manual Content Mode returns and extended the test cycle.
- The first milestone audit happened after implementation and exposed missing cross-phase UI wiring late.

### Patterns Established

- Physical-device behavior is promoted only from same-device evidence, never from `opzdisk/`.
- Destructive success is a persisted state transition, not a successful filesystem call.
- Song synthesis retains immutable parent provenance and explicit pattern membership.

### Key Lessons

- Audit product flows, not only phase-local tests.
- Model empty device slots explicitly instead of forcing occupied-slot contracts onto them.
- Keep device interactions recoverable even in low-stakes personal tools.

## Cross-Milestone Trends

| Milestone | Requirements | Phases | Local tests | Hardware UAT |
|---|---:|---:|---:|---|
| v1.0 | 22/22 | 6/6 | 64 passed | Passed |
