# Phase 2 Multi-Source Coverage Audit

**Audited:** 2026-08-26  
**Result:** All in-scope GOAL, REQ, RESEARCH, and CONTEXT items are covered. No phase split or developer deferral is required.

The context decisions did not include identifiers; `SKELETON.md` assigns D-01 through D-18 for stable plan traceability.

| SOURCE | ID | Feature / Requirement | Plan | Status | Notes |
|---|---|---|---|---|---|
| GOAL | — | Create a complete verified archive, inspect it in a first-class shelf, and safely follow guided manual-device fallback | 01–03 | COVERED | Manifest → shelf → exact-match read-only guidance dependency chain. |
| REQ | ARCH-03 | Versioned archive manifest with project metadata, snippet portability, whole-grid context, source slot/time, and verification evidence | 01 | COVERED | Strict supported schema, writer/classifier reuse, stored-byte evidence. |
| REQ | ARCH-05 | First-class verified archive shelf with name, tags, matrix, provenance, snippet, and verification status | 02 | COVERED | One newest-first server projection and one browser renderer. |
| REQ | SAFE-04 | Archive a verified song and follow guided manual device clearing while automatic clearing remains unproven | 03 | COVERED | Fresh device-only preflight, official checklist, no device write, mounted non-mutation UAT. |
| RESEARCH | R-01 | Keep existing `info.json` as exact schema-1 manifest; no generic schema engine | 01 | COVERED | Plain-object validator, no dependency. |
| RESEARCH | R-02 | One revalidator owns publication, shelf, lookup, and preflight truth | 01–03 | COVERED | Plan 01 creates; Plans 02–03 consume. |
| RESEARCH | R-03 | Share canonical recording roots and verify copied snippet bytes | 01 | COVERED | Includes traversal/symlink/non-regular cases. |
| RESEARCH | R-04 | Derive verified, complete, and eligible independently | 01–03 | COVERED | Persisted eligibility is prohibited. |
| RESEARCH | R-05 | Add one top-level native shelf and one renderer | 02 | COVERED | Existing tabs/render/matrix/escape helpers reused. |
| RESEARCH | R-06 | Add one GET/read-only device-only preflight; keep POST clear fenced | 03 | COVERED | Fresh request-local `captureSource()`/`assertCapturedSource()`, no persisted fingerprint, no `getSource()` fallback, mutation guard, or write helper. |
| RESEARCH | R-07 | Use official physical sequence but do not infer post-clear representation | 03 | COVERED | Checklist delivered; final changed state remains unclassified. |
| RESEARCH | R-08 | Test strict schema, containment, stored-byte tampering, XSS, fallback, and device non-mutation using `node:test` | 01–03 | COVERED | Focused tests per plan plus full suite and opt-in mounted UAT. |
| RESEARCH | R-09 | Install no package and add no module/layer/framework/build step | 01–03 | COVERED | All work remains in three existing files. |
| RESEARCH | R-10 | Resolve all eight approved UI states and accessibility/responsive/reduced-motion contracts | 02–03 | COVERED | Plan 02 covers shelf/archive states; Plan 03 completes preflight/final states. |
| CONTEXT | D-01 | Separate project verification from safe-to-free eligibility | 01–03 | COVERED | Explicit classifier facts, badges, and negative tests. |
| CONTEXT | D-02 | Complete archive contains project, grid, metadata, provenance, and snippet status | 01 | COVERED | Required manifest and publication evidence. |
| CONTEXT | D-03 | Canonically contained included snippet or explicit non-portable status | 01 | COVERED | Four statuses with included-byte proof. |
| CONTEXT | D-04 | Never infer packs; whole-grid capture only | 01 | COVERED | Existing deep copy evidence reused. |
| CONTEXT | D-05 | One plain versioned JSON manifest | 01 | COVERED | Exact schema-1 `info.json`. |
| CONTEXT | D-06 | Archive-relative paths and sanitized facts only | 01–03 | COVERED | Manifest, API, diagnostics, and HTML boundaries tested. |
| CONTEXT | D-07 | Revalidate every included file before publication/reporting | 01–03 | COVERED | Shared classifier and fresh preflight. |
| CONTEXT | D-08 | Unknown/malformed/incomplete/mismatched items stay diagnostics | 01–02 | COVERED | Visible, sanitized, action-free. |
| CONTEXT | D-09 | Top-level Archive Shelf | 02 | COVERED | Third tab, no router. |
| CONTEXT | D-10 | Newest-first at-a-glance archive facts | 02 | COVERED | Deterministic tie-break and compact row. |
| CONTEXT | D-11 | Compact row plus expanded evidence | 02 | COVERED | Native details/summary. |
| CONTEXT | D-12 | Separate diagnostics with no restore/free action | 02–03 | COVERED | Server action absence plus UI negative tests. |
| CONTEXT | D-13 | Checklist only for exact complete archive/source/slot match | 03 | COVERED | Shelf eligibility plus fresh GET preflight. |
| CONTEXT | D-14 | Revalidate immediately and perform no filesystem mutation | 03 | COVERED | Zero-write instrumentation and mounted before/after evidence. |
| CONTEXT | D-15 | Official short ordered physical checklist | 03 | COVERED | Exact UI-SPEC sequence and slot-10 mapping. |
| CONTEXT | D-16 | Stop on mount/source/eligibility loss and retain archive | 03 | COVERED | Stable stop outcomes and archive retention assertions. |
| CONTEXT | D-17 | Smallest browser-native field/disclosure/copy implementation | 01–03 | COVERED | Ponytail constraints and existing-file reuse. |
| CONTEXT | D-18 | Derive matrix from parser output | 02 | COVERED | `parseProject()` → `matrixSvg()`. |

## Resolved Edge Probes

| Edge | Resolution | Automated evidence |
|---|---|---|
| ARCH-03 unclassified | Exact supported schema only; malformed/unknown/incomplete/tampered records remain visible diagnostics with no actions | Plan 01 manifest/classification tests |
| ARCH-05 empty | Verified and diagnostic empty states/counts are independent; singular/plural and newest-first/tie order are deterministic | Plan 02 shelf data/UI state tests |
| ARCH-05 encoding | Metadata is bounded Unicode JSON, preserved exactly, escaped by HTML context, and never a filesystem path | Plan 01 Unicode tests + Plan 02 hostile-markup tests |
| SAFE-04 unclassified | Checklist appears only after fresh request-local mounted capture, exact archive provenance/slot/hash/length match, and final source revalidation; reads are write-free and never use fixture fallback | Plan 03 local instrumentation + mounted UAT |

## Value/Safety Prohibitions — Resolved

| Prohibition | Plan | Blocking test |
|---|---|---|
| Phase 2 must never issue or expose automatic device clearing | 03 | Central POST fence, browser action absence, zero-write call graph, and full mounted-root regular-file equality |
| Project verification must never be presented as whole-song completeness or manual-free eligibility | 01–03 | Classifier separation, shelf badges/reasons, exact-match preflight tests |
| Diagnostic/unverified records must never receive restore or manual-free actions | 01–03 | Server action-field absence and UI diagnostic-region negative assertions |

## Resolved Research Questions

| Question | Resolution | Plan evidence |
|---|---|---|
| Stable mounted-device identity | Persist none. Freshly capture canonical root/dev/inode and exact slot bytes inside each request; compare mounted provenance/slot/SHA-256/length and revalidate before response. | 03 Task 1 substitution/removal tests |
| Cleared-slot disk representation | Remains changed/unclassified in Phase 2; no physical clear, no confirmed-empty claim, and authoritative observation belongs to Phase 6. | 03 Task 1 fail-closed outcomes + Task 2 no-clear UAT |
| Project-only supported manifest placement | Verified shelf with `project only` badge and no manual-free action; malformed/incomplete/legacy records remain diagnostics. | 01 classifier + 02 shelf tests |

The mounted UAT snapshots every regular file beneath the mounted root using relative path, byte length, permission mode, modification time, and SHA-256 before and after. It follows no symlink and performs no screen control, clear, or device write.

## Exclusions (Not Gaps)

- Restore and target-slot writes are Phase 3.
- Split review/synthesis is Phases 4–5.
- Automatic clear and an authoritative post-clear classifier are Phase 6 after destructive hardware acceptance.
- Per-song pack inference, history, descendants, and bounce auto-linking are recorded later work.
- No API coverage matrix is required: the implementation adds no external API, SDK, webhook, OAuth flow, or runtime service dependency.
