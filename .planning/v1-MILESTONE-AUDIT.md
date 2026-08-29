---
milestone: v1
audited: 2026-08-29
status: gaps_found
scores:
  requirements: 9/22
  phases: 2/6
  integration: 8/11
  flows: 4/7
gaps:
  requirements:
    - id: "REST-01..REST-05"
      status: "orphaned"
      phase: "03-guarded-restore-instrument-recovery"
      claimed_by_plans: ["03-01-PLAN.md", "03-02-PLAN.md", "03-03-PLAN.md"]
      completed_by_plans: ["03-01-SUMMARY.md", "03-02-SUMMARY.md", "03-03-SUMMARY.md"]
      verification_status: "missing"
      evidence: "Phase 3 has no VERIFICATION.md. Integration tracing also found that empty slots cannot satisfy the current restore target contract."
    - id: "SPLT-01..SPLT-03"
      status: "orphaned"
      phase: "04-split-review-confirmed-intent"
      claimed_by_plans: ["04-01-PLAN.md"]
      completed_by_plans: ["04-01-SUMMARY.md"]
      verification_status: "missing"
      evidence: "Phase 4 has no VERIFICATION.md; split confirmation also bypasses the global mutation guard and split provenance is omitted from shelf projection."
    - id: "SPLT-04..SPLT-05"
      status: "orphaned"
      phase: "05-validated-split-half-archives"
      claimed_by_plans: ["05-01-PLAN.md"]
      completed_by_plans: ["05-01-SUMMARY.md"]
      verification_status: "missing"
      evidence: "Phase 5 has no VERIFICATION.md and /api/split/acceptance has no browser consumer, breaking the product acceptance-to-restore path."
    - id: "CLEAR-01..CLEAR-03"
      status: "orphaned"
      phase: "06-hardware-gated-automatic-clearing"
      claimed_by_plans: ["06-01-PLAN.md"]
      completed_by_plans: ["06-01-SUMMARY.md"]
      verification_status: "missing"
      evidence: "Phase 6 has no VERIFICATION.md; clear success is currently inferred from same-mount file absence instead of a reconnect-confirmed state."
  integration:
    - "Phase 6 cleared-slot state cannot satisfy Phase 3 restore target validation."
    - "Phase 5 split acceptance API has no browser consumer or user-visible acceptance path."
    - "Phase 6 clear reports success before an eject/reconnect confirmation boundary."
  flows:
    - "Archive, clear, and restore later breaks when selecting the empty target."
    - "Synthesized half acceptance and restore breaks at the orphaned acceptance route."
    - "Automatic clear confirmation ends before reconnect validation."
tech_debt:
  - phase: "04-split-review-confirmed-intent"
    items:
      - "Split provenance and pending acceptance reason are omitted from Archive Shelf projection."
      - "Split confirmation is not serialized through the shared mutation guard."
nyquist:
  compliant_phases: []
  partial_phases: []
  not_validated_phases: []
  missing_phases: []
  overall: "inactive"
---

# Milestone v1 Audit

## Result

The milestone is not ready to ship. The phase completion ledger and all 22 requirement checkboxes claim completion, but only Phases 1 and 2 have phase-level verification reports. The required cross-phase trace found three broken product flows.

## Phase Verification

| Phase | Verification | Result |
|---|---|---|
| 1. Verified Transaction Foundation | `01-VERIFICATION.md` | Passed |
| 2. Verified Archive Shelf & Manual Freeing | `02-VERIFICATION.md` | Passed |
| 3. Guarded Restore & Instrument Recovery | Missing | Blocker |
| 4. Split Review & Confirmed Intent | Missing | Blocker |
| 5. Validated Split-Half Archives | Missing | Blocker |
| 6. Hardware-Gated Automatic Clearing | Missing | Blocker |

## Three-Source Requirements Cross-Check

| Requirements | REQUIREMENTS.md | SUMMARY frontmatter | VERIFICATION.md | Final status |
|---|---|---|---|---|
| ARCH-01, ARCH-02, ARCH-04, SAFE-01, SAFE-02, SAFE-03 | Complete | Listed | Passed | Satisfied |
| ARCH-03, ARCH-05, SAFE-04 | Complete | Listed | Passed | Satisfied |
| REST-01..REST-04 | Complete | Listed | Missing | Orphaned / unsatisfied |
| REST-05 | Complete | Not explicitly listed | Missing | Orphaned / unsatisfied |
| SPLT-01..SPLT-03 | Complete | Listed | Missing | Orphaned / unsatisfied |
| SPLT-04..SPLT-05 | Complete | Listed | Missing | Orphaned / unsatisfied |
| CLEAR-01..CLEAR-03 | Complete | Listed | Missing | Orphaned / unsatisfied |

## Cross-Phase Integration

The integration checker verified eight major contracts: pinned capture through verified shelf publication; occupied-target project restore; whole-grid restore; split review through deterministic half synthesis; and the supporting source, recovery, and acceptance gates.

The following release blockers remain:

1. **Cleared-slot restore:** Phase 6 represents an empty slot without the fingerprint and source token required by Phase 3. The browser cannot select it and the server attempts to capture a target file that no longer exists. Affected: REST-01, REST-02, REST-03, CLEAR-02, CLEAR-03.
2. **Split hardware acceptance:** `/api/split/acceptance` is not consumed by the browser, so a pending synthesized half cannot complete acceptance through the product. Affected: SPLT-05.
3. **Reconnect confirmation:** `/api/clear-slot` treats same-request file absence as confirmed success; it does not wait for and validate a later reconnect. Affected: CLEAR-02.

## E2E Flows

| Flow | Status |
|---|---|
| Archive occupied slot into a verified shelf record | Complete |
| Restore a verified archive over an occupied target with recovery | Complete |
| Restore a whole instrument grid with deep recovery | Complete |
| Review and synthesize a confirmed split half | Complete |
| Archive, clear, then restore into the cleared slot | Broken at empty-target selection |
| Accept a synthesized half on hardware, then restore | Broken at acceptance UI/API connection |
| Automatically clear and confirm after reconnect | Broken before reconnect confirmation |

## Required Closure

- Add an explicit empty-target restore contract that does not invent a previous project and still validates the same mounted device and chosen slot.
- Model automatic clear as pending until a later same-device reconnect confirms the slot is empty; retain recovery throughout.
- Expose split acceptance state/provenance and a product-facing way to record the five observed hardware outcomes.
- Serialize split confirmation and publish split provenance in the shelf projection.
- Add Phase 3–6 verification reports only after the repaired flows and complete suite pass.

