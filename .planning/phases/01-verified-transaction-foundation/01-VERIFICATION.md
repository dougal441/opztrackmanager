---
phase: 01-verified-transaction-foundation
verified: 2026-08-25T14:24:24Z
status: passed
score: 11/11 must-haves verified
behavior_unverified: 0
overrides_applied: 0
decision_coverage:
  honored: 0
  total: 0
  not_honored: []
re_verification:
  previous_status: human_needed
  previous_score: 10/11
  gaps_closed:
    - "Browser mutation busy/reset state now has a direct behavioral VM regression test for success and failure."
  gaps_remaining: []
  regressions: []
---

# Phase 1: Verified Transaction Foundation Verification Report

**Phase Goal:** Users can start destructive archive and restore workflows knowing the app captures one source, validates intent, and preserves data unless verification succeeds.
**Verified:** 2026-08-25T14:24:24Z
**Status:** passed
**Re-verification:** Yes — after behavior-evidence closure

## User Flow Coverage

Phase 1 predates formal user-story wording. Per the verification instruction, this table uses the explicit phase goal and roadmap success criteria. Restore execution is owned by Phase 3; Phase 1's observable restore outcome is the fail-closed route/UI fence, not a device write.

| Step | Expected | Evidence | Status |
| --- | --- | --- | --- |
| Identify target | The persistent status distinguishes mounted OP-Z, local fixture, and no source. | `server.js:736-745` returns source state; `app/index.html:315-329` renders text labels and active operation facts. | ✓ VERIFIED |
| Confirm archive intent | Confirmation identifies operation, source, slot/song, and that device data will not change. | `app/index.html:483-495`; static contract test passes. | ✓ VERIFIED |
| Run safely | Mutation controls disable immediately and remain disabled while browser/server state is active, then reset after success/failure. | `app/index.html:281-289,322-333` is wired; `test/transaction.test.js:225-244` evaluates the actual `runMutation()` function in `node:vm` and proves `[true, false]` plus `mutationBusy === null` after success and rejection. | ✓ VERIFIED |
| Publish result | Only reread, byte-identical, parsable bytes become a visible verified archive, with source-specific guidance. | `server.js:581-634`; filesystem integration and mounted UAT pass. | ✓ VERIFIED |
| Preserve unsafe/later work | Unverified items have no restore action; restore and other device writes return `PHASE_UNAVAILABLE`. | `server.js:30-45,730-735`; `app/index.html:497-539`; route/UI tests pass. | ✓ VERIFIED |

## Goal Achievement

### Observable Truths

Roadmap truths take precedence. PLAN truths that restate them are merged into the corresponding row; plan-only edges remain separate.

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Archive source bytes, canonical root/device identity, and project identity are captured once inside the accepted guard; later source removal/replacement/change stops without fallback resolution. | ✓ VERIFIED | `captureSource()` records root `dev`/`ino`, path, Buffer, SHA-256, and length (`server.js:513-535`); `assertCapturedSource()` directly revalidates them without `getSource()` (`server.js:536-551`); backup resolves/captures inside `withMutation()` (`server.js:769-782`). The source-substitution and HTTP guard-before-capture tests pass. |
| 2 | Invalid slots, flags, bundle IDs, paths, and competing mutations are rejected before unsafe filesystem work; the global guard rejects rather than queues and releases after success/failure. | ✓ VERIFIED | Strict validators/containment are at `server.js:436-458,642-678`; the awaited `try/finally` guard is at `server.js:553-564`. Input, symlink escape, direct conflict, and HTTP zero-source-work tests pass. |
| 3 | Users receive mounted/local source identity and the applicable eject, reconnect, and refresh guidance. | ✓ VERIFIED | Server guidance branches on captured `source.device` (`server.js:505-511,627`); state flows through `load()`/`render()` (`app/index.html:302-339`) and archive result through `toast()` (`app/index.html:483-495`). Named guidance tests pass for both source kinds. |
| 4 | A visible verified archive is published only after staged bytes are flushed, reread, exactly compared, reparsed, evidenced with SHA-256/length, and source-revalidated; verification failure leaves the source unchanged and no visible archive. | ✓ VERIFIED | Ordered stage/check/evidence/rename flow at `server.js:581-634`; library eligibility independently rereads/parses/evidence-checks at `server.js:233-285,656-678`. Happy-path, corruption, parser rejection, source substitution, and published-corruption tests pass. |
| 5 | Zero-length or undersized staged projects cannot publish. | ✓ VERIFIED | `parseProject(stored)` gates publication at `server.js:604-605`; the undersized binary test passes and asserts zero visible bundles. |
| 6 | Project bytes remain Buffer data with no text decoding, preserving zero and non-text bytes exactly. | ✓ VERIFIED | Capture/read/write/reread use Buffers (`server.js:522-533,586-604`); the binary test proves bytes containing `0x00` and values above `0x7f` remain identical. |
| 7 | Restore, swap, clear, instrument writes, snapshot, and op1.fun installation are unavailable before their later verified-recovery phases and perform no device write. | ✓ VERIFIED | Central route inventory and pre-dispatch `PHASE_UNAVAILABLE` fence at `server.js:29-45,730-735`; corresponding UI buttons are natively disabled. The route-inventory test passes all eight endpoints. |
| 8 | The localhost mutation boundary rejects non-JSON, missing-header, cross-site, mismatched-Origin/Host, malformed UTF-8/JSON, and path-shaped input with stable path-free 4xx errors. | ✓ VERIFIED | `requireMutationRequest()` and safe outer error serialization at `server.js:411-434,927-934`; request-boundary test passes all cases and checks path omission. |
| 9 | Browser-local/server-owned mutation state disables controls during work and restores them after success or failure. | ✓ VERIFIED | `runMutation()` and render wiring exist at `app/index.html:281-289,322-333`. The named VM test at `test/transaction.test.js:225-244` executes the actual function and proves render-state sequence `[true, false]` and `mutationBusy === null` after both success and a thrown failure; the adjacent contract test maps active state to native `disabled` on every mutation control. |
| 10 | Verified archives and `verified:false` legacy/corrupt/partial/failed diagnostics render separately, and no unverified item receives a restore selector/control. | ✓ VERIFIED | Server scanning separates evidence-backed items and sanitized drafts (`server.js:233-318`); UI filters into separate regions and creates restore UI only for verified items (`app/index.html:497-539`). Segregation and corrupt-item tests pass. |
| 11 | Direct mounted-device API UAT proves a laptop archive matches mounted slot 1 while the source SHA-256 and length remain unchanged. | ✓ VERIFIED | Independently rerun `OPZ_HARDWARE_UAT=1 node --test --test-name-pattern='mounted API archive UAT' test/transaction.test.js`: 1/1 passed. Source and stored archive are 342,848 bytes with SHA-256 `a9f675e133646d6e5df36cbb38ff01a123d62929351b75f7bbd907028dd1abad`; stored bytes equal source. No device-writing route was called. |

**Score:** 11/11 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `server.js` | Source capture/revalidation, transaction guard, verified archive publication, request/path boundary, route fences, sanitized state/result | ✓ VERIFIED | 975 lines; exported helpers exist; archive API invokes them; parser/library/state wiring and real filesystem data flow verified. |
| `app/index.html` | Mutation header, source/status rendering, confirmations, shared busy state, and diagnostic segregation | ✓ VERIFIED | 893 lines; served by `server.js`; API/state/result data reach render/toast and controls. Browser script parses successfully, and the real busy wrapper is now executed by a regression test. |
| `test/transaction.test.js` | Dependency-free behavioral and HTTP/filesystem regression checks | ✓ VERIFIED | 31 tests declared; the generic run passes 30 local checks with only the opt-in hardware test skipped, the hardware test passed independently, and the new named VM regression passed independently during re-verification. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `app/index.html` | `/api/backup` in `server.js` | `backup()` passes slot/name/deep through shared `api()` | ✓ WIRED | `app/index.html:272-279,483-495`; `server.js:769-801`. |
| `server.js` archive | `parser.js` | Parses the reread staged Buffer | ✓ WIRED | `server.js:600-605`; `parseProject` imported at line 12. |
| `server.js` archive | `library/` | Hidden same-root draft, evidence write, final rename | ✓ WIRED | `server.js:581-634`; real mounted UAT produced a verified laptop bundle. |
| Browser POST funnel | `requireMutationRequest()` | `X-OPZ-Mutation: 1` plus JSON | ✓ WIRED | `app/index.html:272-274`; `server.js:411-434,729`. |
| `/api/backup` | `withMutation()` | Guard precedes resolver and capture | ✓ WIRED | `server.js:769-782`; HTTP barrier test proves zero conflict-side resolver/capture calls. |
| `resolveChild()` | Server-controlled library roots | Canonical root/child plus `path.relative()` containment | ✓ WIRED | `server.js:642-678`; symlink-escape test passes. |
| `/api/state` | `render()` | `STATE.source`, `STATE.mutation`, and `STATE.drafts` | ✓ WIRED | `server.js:736-745`; `app/index.html:302-339,497-539`. |
| `runMutation()` | Mutation buttons | `try/finally` plus native `disabled` assignment | ✓ WIRED | Source wiring is complete at `app/index.html:281-289,331-333`; the VM regression executes success/failure reset behavior and the adjacent contract test verifies native-disabled mapping. |
| Archive response | Accessible toast/status | `verified`, `source`, and `guidance` payload | ✓ WIRED | `server.js:627,794-800`; `app/index.html:267-279,329,491-495`. |

The automated key-link query reported false negatives for PLAN entries whose `from`/`to` fields contain component descriptions rather than relative paths. Manual call/data-flow tracing above resolves those parser limitations.

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| Source/status UI | `STATE.source`, `STATE.mutation` | `/api/state` → `scanSlots()`/`activeMutation` → `load()` | Yes, current filesystem source and live process mutation state | ✓ FLOWING |
| Archive shelf | `STATE.library` | `/api/state` → `scanLibrary()` → reread `song.opz` and `info.json` | Yes, filesystem-backed verified/unverified records | ✓ FLOWING |
| Draft diagnostics | `STATE.drafts` | `/api/state` → `scanDrafts()` → hidden partial/failed diagnostic files | Yes, sanitized filesystem-backed failures | ✓ FLOWING |
| Archive result | `r.file`, `r.guidance` | `/api/backup` → `archiveCapturedProject()` result | Yes, returned only after final publication | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Complete fixture/API regression suite | `node --test test/transaction.test.js` | 31 discovered; 30 passed, mounted UAT skipped by default, 0 failed | ✓ PASS |
| Server syntax | `node --check server.js` | Exit 0 | ✓ PASS |
| Browser script syntax | Extract inline `<script>` and compile with `new Function()` | 1 script parsed | ✓ PASS |
| Mounted archive preserves source | `OPZ_HARDWARE_UAT=1 node --test --test-name-pattern='mounted API archive UAT' test/transaction.test.js` | 1 passed, 0 failed | ✓ PASS |
| Browser mutation resets after success/failure | `node --test --test-name-pattern='mutation busy state resets after success and failure' test/transaction.test.js` | 1 passed, 0 failed; actual `runMutation()` executed in `node:vm` | ✓ PASS |

The normal suite emitted a `MaxListenersExceededWarning` because the same exported server accumulates one-shot error listeners across tests. It did not affect outcomes, but is test-harness cleanup debt.

### Probe Execution

No PLAN/SUMMARY probe scripts were declared, and no conventional `scripts/**/tests/probe-*.sh` files exist. Step 7c: N/A.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| ARCH-01 | 01-01, 01-02 | Capture source bytes/device identity once for the operation | ✓ SATISFIED | Capture fields, guard ordering, and zero-work conflict tests. |
| ARCH-02 | 01-01, 01-03 | Publish only after reread/equality/reparse/SHA-256/length | ✓ SATISFIED | Ordered implementation, fixture test, and independent mounted UAT. |
| ARCH-04 | 01-01, 01-03 | Preserve source on capture/verification failure | ✓ SATISFIED | Corruption/parser/source-substitution tests plus no source-writing path. |
| SAFE-01 | 01-01, 01-02 | Stop pinned mounted operation without fixture fallback | ✓ SATISFIED | Direct root identity validation and source-substitution test; no post-capture resolver. |
| SAFE-02 | 01-02, 01-03 | Reject invalid identifiers/paths/concurrency | ✓ SATISFIED | Validators, canonical containment, global guard, API route tests. |
| SAFE-03 | 01-03 | Show mounted/local target and physical guidance | ✓ SATISFIED | Source-specific server payload and UI render wiring; content tests pass. The broader busy-state transition remains the separate human item. |

No orphaned Phase 1 requirement was found: ROADMAP, REQUIREMENTS, and PLAN frontmatter all name the same six IDs.

### Prohibition Verification

The legacy PLAN entries omit a `verification:` tier. Each nevertheless has direct wired negative-test enforcement, so none is silently passed on judgment alone.

| Prohibition | Status | Enforcement Evidence |
| --- | --- | --- |
| No partial, byte-mismatched, or parse-failed draft appears verified/restore-eligible | ✓ VERIFIED | Corruption/parser tests, `scanLibrary()` evidence gate, `findBundle()` rejection, segregated UI. |
| Archive verification failure does not delete, overwrite, or recapture the source | ✓ VERIFIED | Failure tests compare source hash; archive writes only captured Buffer to laptop draft. |
| Path-shaped user values are not normalized into valid targets | ✓ VERIFIED | Positive identifier validation and containment tests. |
| A competing mutation is not queued, interleaved, or partially started | ✓ VERIFIED | Promise-barrier helper and HTTP tests assert zero competitor resolver/capture work. |
| Mounted and fixture outcomes are not described as the other source kind | ✓ VERIFIED | Source-specific guidance branches and tests. |
| Unverified items do not render restore controls | ✓ VERIFIED | Rendering regions are structurally separated; static negative assertion checks both unverified loops. |

### Decision Coverage

The configured decision-coverage tool returned: `No trackable decisions in CONTEXT.md.` Manual verification nevertheless mapped every `<decisions>` bullet to the truths and prohibitions above. This gate is non-blocking.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
| --- | --- | ---: | ---: | --- | --- | --- |
| `test/transaction.test.js` | ARCH-01, ARCH-02, ARCH-04, SAFE-01, SAFE-02, SAFE-03 | 31 when hardware opt-in is enabled | 1 by default; rerun passed | No | Behavioral for server/filesystem/API and browser busy/reset state | ✓ PASS |

**Disabled tests on requirements:** 0 — the conditional hardware test was explicitly enabled and passed.
**Circular patterns detected:** 0 — temporary fixtures copy independent `.opz` input; expected hashes use `node:crypto`, and the mounted source is independently reread before/after.
**Insufficient assertions:** 0 — the source-contract test is now paired with direct VM execution of the real busy/reset function.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `test/transaction.test.js` | test process warning | Reused server accumulates more than ten one-shot `error` listeners | ⚠️ Warning | Test output is noisy and could hide a future listener leak; current assertions and phase behavior still pass. |

No `TBD`, `FIXME`, or `XXX` debt marker exists in the phase-modified files. Placeholder-text matches are normal HTML input placeholders, and `return null` matches are legitimate unavailable-data/range branches rather than stubs.

### Human Verification Required

None. The prior browser state-transition item is now behaviorally covered without screen control by executing the actual `runMutation()` function in `node:vm`; the adjacent UI contract verifies that active mutation state maps to native disabled controls.

### Disconfirmation Pass

- **Partially proven requirement check:** none remains among the 11 merged roadmap/PLAN truths.
- **Passing source-contract test that would be insufficient alone:** `mutation controls share one operation-aware busy wrapper` still uses regex inspection, but it is now paired with direct VM behavior proof for the state transition.
- **Uncovered error path:** failure to write/move retained draft diagnostics is handled fail-safe at `server.js:574-579`, but no test injects that secondary diagnostic-storage failure. This does not defeat the goal because the original `.partial-*` remains hidden and the source write path is still absent.

### Gaps Summary

No observable implementation or behavior-evidence gap blocks the phase goal. Archive capture, validation, serialization, verified publication, source preservation, route fences, diagnostic segregation, browser busy/reset behavior, and direct mounted-device preservation all have behavioral evidence. Phase 1 passes; restore execution and device writes remain correctly deferred and fenced for their owning later phases.

---

_Verified: 2026-08-25T14:24:24Z_
_Verifier: the agent (gsd-verifier)_
