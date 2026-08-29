---
phase: 02
slug: verified-archive-shelf-manual-freeing
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-26
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js 22 built-in `node:test` |
| **Config file** | none — extend the existing test file |
| **Quick run command** | `node --test --test-name-pattern='manifest|snippet|shelf|manual free|mount' test/transaction.test.js` |
| **Full suite command** | `node --test test/transaction.test.js` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run the targeted `--test-name-pattern` command for the changed seam
- **After every plan wave:** Run `node --test test/transaction.test.js && node --check server.js`
- **Before phase verification:** Full suite and mounted read-only UAT must be green
- **Max feedback latency:** 10 seconds locally

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-W0-01 | planner assigns | 1 | ARCH-03 | T-02-01 manifest tampering | Supported versioned manifests are derived from stored project, metadata, pack, snippet, and source evidence; unknown or corrupt records are diagnostics | filesystem integration | `node --test --test-name-pattern='manifest' test/transaction.test.js` | ✅ extend | ⬜ pending |
| 02-W0-02 | planner assigns | 1 | ARCH-03 | T-02-02 snippet escape/disclosure | Snippets copy only from canonical allowed recording roots, store archive-relative paths, and reread/hash exact stored bytes | filesystem integration | `node --test --test-name-pattern='snippet' test/transaction.test.js` | ✅ extend | ⬜ pending |
| 02-W0-03 | planner assigns | 2 | ARCH-05 | T-02-03 misleading shelf/XSS | Shelf and diagnostics are disjoint, newest-first, escaped, and expose no action for unverified records | integration/static UI | `node --test --test-name-pattern='shelf|diagnostic|matrix|tab' test/transaction.test.js` | ✅ extend | ⬜ pending |
| 02-W0-04 | planner assigns | 3 | SAFE-04 | T-02-04 source fallback/device write | Manual-free preflight is device-only, fresh, read-only, fail-closed, and never reaches a mutation or `opzdisk/` fallback | HTTP/filesystem integration | `node --test --test-name-pattern='manual free|mount' test/transaction.test.js` | ✅ extend | ⬜ pending |
| 02-W0-05 | planner assigns | 3 | SAFE-04 | T-02-05 false empty result | No missing-file or zero-pattern state is called empty without a recorded hardware observation | contract + mounted UAT | `OPZ_HARDWARE_UAT=1 node --test --test-name-pattern='manual free mounted UAT' test/transaction.test.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Extend `test/transaction.test.js` with versioned manifest, snippet containment, shelf classification, and read-only preflight fixtures.
- [ ] Add one opt-in mounted UAT that archives a complete song to the laptop, runs preflight, and proves the mounted source tree is byte-identical before/after.
- [ ] Keep the post-clear classifier fail-closed until a real physical clear/remount observation supplies an authoritative fixture; do not synthesize or guess an empty project.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Official OP-Z physical selection/eject/clear/reconnect sequence is accurate | SAFE-04 | Requires pressing hardware buttons and observing device LEDs/restart | Compare the rendered checklist to the official project and disk-mode guides; do not perform or automate the clear during ordinary Phase 2 UAT |
| Actual post-clear disk representation | SAFE-04 / later CLEAR work | Official docs do not define whether a cleared slot is absent, canonical-empty, or merely unused | Defer a destructive observation until a verified recovery archive exists and the hardware-clear acceptance plan explicitly restores the original afterward |

---

## Validation Sign-Off

- [x] All planned behavior has an automated check or an explicit hardware gate
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 extends existing infrastructure; no test dependency is introduced
- [x] No watch-mode flags
- [x] Feedback latency < 10 seconds locally
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved for planning 2026-08-26
