# Walking Skeleton — OP-Z Manager

**Phase:** 1
**Generated:** 2026-08-25

## Phase Goal

**As Dougal, I want archive and restore operations to pin one OP-Z source and publish results only after verification, so that I can manage slots without losing recoverable song data.**

## Capability Proven End-to-End

Dougal can confirm an archive against the displayed OP-Z or local fixture, create it through the localhost API, and see it become restore-eligible only after the stored project bytes match, parse successfully, and carry SHA-256 plus byte-length evidence.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Runtime and framework | Existing CommonJS Node.js server using built-in `http`, `fs`, `path`, and `crypto` | The installed runtime and current composition root already provide every required transaction primitive without a dependency or build step. |
| Data layer | Existing OP-Z/local-fixture filesystem plus hidden drafts under `library/` | The filesystem is the product's source of truth; same-parent atomic rename provides the publication boundary. |
| Format verification | Existing `parseProject()` plus exact `Buffer.equals()` and SHA-256/length evidence | One in-repo parser remains authoritative, while stored-byte rereading proves the archive rather than merely the input. |
| Mutation coordination | One process-wide reject-not-queue guard in `server.js` | OP-Z Manager is one localhost process; a single guarded transaction is the smallest correct concurrency model. |
| Auth and request boundary | No account system; loopback binding plus JSON, a custom mutation header, Origin/Fetch-Metadata checks, and positive input validation | This preserves zero configuration while preventing simple cross-site localhost POSTs and malformed path/slot input. |
| UI | Existing browser-native single page in `app/index.html` | Native buttons, dialogs, disabled state, source badge, and toast/status regions already cover the interaction contract. |
| Deployment target | Existing macOS launcher and `node server.js` on `127.0.0.1:8765` | The product remains double-click-and-go and local-only. |
| Directory layout | Keep `server.js`, `parser.js`, `app/index.html`; add only `test/transaction.test.js` | This follows the established composition-root architecture and leaves one dependency-free runnable safety check. |

## Stack Touched in Phase 1

- [x] Existing project scaffold — CommonJS Node.js, browser-native UI, no package manifest or build step
- [x] Routing — `/api/backup`, `/api/state`, and the shared mutation request boundary
- [x] Storage read/write — captured OP-Z bytes staged, reread, verified, evidenced, and atomically published
- [x] UI interaction — source-aware confirmation, busy state, result guidance, and segregated failed drafts
- [x] Local full-stack run — `NO_OPEN=1 node server.js`, with safe direct API UAT against `/Volumes/OP-Z`

## Decision Traceability

The accepted CONTEXT decisions did not carry identifiers, so this plan set assigns stable local trace IDs without changing their substance:

| ID | Accepted decision |
|---|---|
| D-01 | Permit one destructive mutation globally; reject rather than queue. |
| D-02 | Capture source bytes once and reuse that snapshot. |
| D-03 | Bind source kind, canonical root, filesystem identity, and project identity. |
| D-04 | Stop on mounted-source disappearance/change without falling back to `opzdisk/`. |
| D-05 | Keep unverified drafts visibly separate and restore-ineligible. |
| D-06 | Stage in hidden library directories and publish only by atomic rename after verification. |
| D-07 | Require stored-byte reread, exact equality, successful parse, SHA-256, and byte length. |
| D-08 | Retain a labelled failed copy and leave the source slot untouched. |
| D-09 | Keep a persistent mounted-OP-Z/local-fixture badge and repeat the source in confirmations. |
| D-10 | Confirm operation, source, slot, current song, and whether device data may change. |
| D-11 | Disable mutation controls, show the active operation, and reject competing requests. |
| D-12 | Return explicit outcome plus eject, reconnect, refresh, or recovery guidance. |
| D-13 | Use the smallest safe hidden-partial/failed-draft naming and retention design. |
| D-14 | Reuse existing badge, dialog, and toast placement/wording patterns. |

## Out of Scope (Deferred to Later Slices)

- First-class archive shelf metadata and manual slot-freeing guidance (Phase 2)
- Full restore execution, verified target backup, post-write checks, and instrument recovery (Phase 3)
- Split detection/review and recorded intent (Phase 4)
- Synthesized split-half archives and hardware acceptance (Phase 5)
- Hardware-gated automatic clearing (Phase 6)
- Per-song sample-pack restore, full-device snapshots, descendant history, and bounce auto-linking (post-milestone items already recorded in project planning)

## Subsequent Slice Plan

- Phase 2: Browse complete verified archives and safely follow manual device clearing.
- Phase 3: Restore a verified archive into an explicit target with a verified recovery capture.
- Phase 4: Review and confirm suspected split projects without changing originals.
- Phase 5: Produce independently restorable split halves only after deterministic and hardware checks.
- Phase 6: Enable automatic clearing only behind proven fixture and sacrificial-device acceptance.
