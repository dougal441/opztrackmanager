---
phase: 01
slug: verified-transaction-foundation
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-25
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js 22 built-in `node:test` |
| **Config file** | none — Wave 0 creates one test file |
| **Quick run command** | `node --test test/transaction.test.js` |
| **Full suite command** | `node --test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test test/transaction.test.js`
- **After every plan wave:** Run `node --test && node --check server.js`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-W0-01 | 01-01 | 1 | ARCH-01 | T-01 source substitution | Guard is acquired before resolver/capture; accepted source bytes/root/device identity remain fixed | integration | `node --test --test-name-pattern="mutation conflict" test/transaction.test.js` | ❌ W0 | ⬜ pending |
| 01-W0-02 | 01-01 | 1 | ARCH-02 | T-02 false verification | Publication requires reread equality, successful parse, SHA-256, and length evidence | integration | `node --test --test-name-pattern="verified archive tracer" test/transaction.test.js` | ❌ W0 | ⬜ pending |
| 01-W0-03 | 01-01 | 1 | ARCH-04 | T-03 destructive failure | Corruption or parse failure leaves source bytes unchanged and no visible archive | integration | `node --test --test-name-pattern="failed draft" test/transaction.test.js` | ❌ W0 | ⬜ pending |
| 01-W0-04 | 01-01 | 1 | SAFE-01 | T-01 source substitution | A removed or replaced captured root stops without invoking fallback | integration | `node --test --test-name-pattern="source substitution" test/transaction.test.js` | ❌ W0 | ⬜ pending |
| 01-W0-05 | 01-02 | 2 | SAFE-02 | T-04 invalid/concurrent input | Invalid slots, flags, IDs, canonical/symlink-escaped paths, and concurrent mutations are rejected; later-phase device writes are unavailable | unit/integration | `node --test test/transaction.test.js` | ❌ W0 | ⬜ pending |
| 01-W0-06 | 01-03 | 3 | SAFE-03 | T-05 misleading state | API and UI expose captured source, busy state, unavailable later-phase controls, confirmation, and outcome guidance | HTTP/static + UAT | `node --test --test-name-pattern="source status UI" test/transaction.test.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/transaction.test.js` — one built-in test file covering all six requirements with temporary copies of a valid `.opz` fixture
- [ ] Guard `server.listen()` with `require.main === module` and export only critical helpers needed by the test
- [ ] Add HTTP/static assertions for mutation-request rejection and source/guidance payloads without a browser-test dependency

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mounted OP-Z source is reported consistently before and after refresh | SAFE-03 | Requires the mounted hardware | Query `/api/state` twice and confirm `source.device === true`, label remains `OP-Z`, and the same chosen slot parses |
| Mounted-slot archive leaves the chosen source slot unchanged and produces verified evidence | ARCH-02, ARCH-04 | Requires the mounted hardware | Hash one selected device slot, archive through the API, verify stored SHA-256/length and exact bytes, then hash that same source slot again and require equality |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15 seconds
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** contract internally consistent; implementation remains pending Wave 0 execution
