---
phase: 03
slug: guarded-restore-instrument-recovery
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-27
---

# Phase 03 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` |
| Config | none — extend `test/transaction.test.js` |
| Quick run | `node --test --test-name-pattern='restore|recovery|swap|instrument|grid' test/transaction.test.js` |
| Full run | `node --test test/transaction.test.js && node --check server.js` |
| Hardware gate | `OPZ_HARDWARE_UAT=1 node --test --test-name-pattern='mounted restore|mounted grid' test/transaction.test.js` |
| Local feedback target | under 15 seconds |

## Sampling Rate

- After every task commit: run the narrow test-name pattern for the changed transaction seam.
- After every plan: run the complete Node suite and syntax check.
- Before verification: run the complete suite plus both opt-in mounted UATs against a detected device source.
- Never substitute `opzdisk/` results for the mounted gate.

## Per-Task Verification Map

| ID | Requirement | Threat | Secure behavior | Test |
|----|-------------|--------|-----------------|------|
| 03-W0-01 | REST-01 | implicit/stale target | no preselected target; exact live fingerprint must still match | HTTP/static + integration |
| 03-W0-02 | REST-02 | overwrite before protection | verified automatic backup publishes before canonical target changes | failpoint integration |
| 03-W0-03 | REST-03 | corrupt/stale input or false success | archive is freshly pinned; output exact-rereads and parses | filesystem integration |
| 03-W0-04 | REST-04 | partial mutation without recovery | every post-mutation failure returns retained recovery ID and non-success | failpoint HTTP integration |
| 03-W0-05 | REST-05 | implicit/overlay grid mutation | separate action; verified pre-grid snapshot; exact replacement including absences | filesystem integration |
| 03-W0-06 | REST-02/04 | partial swap | both slots protected before either write; both receipts retained | filesystem integration |
| 03-W0-07 | REST-05 | path escape/cross-volume loss | imports canonicalized; recovery copy verified before removal | security integration |
| 03-W0-08 | REST-03/05 | fixture-only confidence | same-byte project and whole-grid write/readback on mounted OP-Z | opt-in hardware UAT |

## Required Failpoints

- backup publication fails before write;
- selected target changes after preview;
- archive evidence changes after shelf render;
- source disappears before write and between write/readback;
- target readback differs or no longer parses;
- rollback succeeds and rollback cannot safely run;
- grid replacement encounters a stale extra file;
- mounted transaction loses source while `opzdisk/` is available;
- second swap write fails after first verifies.

## Mounted UAT Contract

1. Require a detected `device: true` source or skip without mutation.
2. Snapshot every regular device file by relative path and SHA-256.
3. Create verified recovery archives first.
4. Restore one slot's own exact archived bytes to the same explicitly selected slot.
5. Restore the archived whole grid over the unchanged current grid.
6. Require output reread equality, parsing, recovery receipts, and no unrelated content changes.
7. Restore the initial content if any canonical byte differs and verify exact final SHA-256 equality before exit.
8. Do not use screen control, eject, clear, or claim normal-mode playback acceptance.

## Sign-Off

- [x] Every REST requirement has an automated test seam.
- [x] Device writes have an explicit opt-in mounted gate and recovery-first order.
- [x] No new test framework or dependency.
- [x] Source disappearance and fallback substitution are covered.
- [x] `nyquist_compliant: true` recorded.

