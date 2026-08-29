---
status: resolved
trigger: "When navigating top tabs, Archive Shelf and Instruments render below Songs instead of replacing it"
created: 2026-08-29
updated: 2026-08-29
---

# Symptoms

- Expected: selecting Songs, Archive Shelf, or Instruments shows only that top-level section.
- Actual: Songs remains at the top; Archive Shelf and Instruments appear underneath it when selected.
- Error: no error message reported.
- Timeline: observed after the v1 interface work; exact introduction point unknown.
- Reproduction: start the app and click Archive Shelf or Instruments in the top navigation.

# Current Focus

- bug_class: bohrbug
- reasoning_checkpoint:
    hypothesis: "The author rule `main { display: grid; }` overrides the user-agent `[hidden] { display: none; }`, so `setTab()` sets the correct state while the Songs `<main>` remains rendered."
    confirming_evidence:
      - "`setTab()` sets `hidden = !active` on all three top-level panels."
      - "Songs and Instruments are `<main>` elements matched by an author `display: grid` rule; Archive Shelf is a `<section>` and hides correctly."
    falsification_test: "A regression requiring an author-level `[hidden] { display: none }` rule would already pass, or browser cascade inspection would show the Songs panel computed as `display: none` without it."
    fix_rationale: "One shared `[hidden]` rule restores the native hidden contract for every panel and future element instead of special-casing Songs in `setTab()`."
    blind_spots: "No browser automation dependency exists, so the regression checks the exact CSS cascade invariant rather than computed layout in multiple browsers."
    candidate_causes:
      - "code: the global author `main` display rule defeats the hidden attribute's user-agent styling"
      - "environment: a browser would only differ if it gave user-agent `[hidden]` precedence over author CSS, contrary to the CSS cascade"
      - "data: persisted tab values are validated and cannot explain why Songs stays visible after a valid tab selection"
    and_gate: "no — the author CSS override alone deterministically explains the symptom; persisted state and source data are not required"
- hypothesis: confirmed
- test: Add a specified-oracle regression for the `[hidden]` cascade invariant, prove it fails, then add the one-line shared CSS rule.
- expecting: The regression fails before the CSS rule and passes afterward; the full adjacent suite remains green.
- next_action: add and run the failing regression test
- next_action: Archive the resolved session, commit the focused fix, and add the recurrence pattern to the debug knowledge base.

# Evidence

- timestamp: 2026-08-29
  checked: knowledge base
  found: No matching prior debug entry was available.
  implication: Investigate from current DOM and CSS evidence.
- timestamp: 2026-08-29
  checked: app/index.html top-level panels and setTab()
  found: setTab() sets hidden on every inactive panel and validates persisted tab names.
  implication: State management is correct; the failure occurs during presentation.
- timestamp: 2026-08-29
  checked: app/index.html CSS cascade
  found: The author rule `main { display: grid; }` matches Songs and overrides the browser default hidden styling; Archive Shelf is a section and therefore hides.
  implication: The CSS rule is the deterministic root cause.
- timestamp: 2026-08-29
  checked: spectrum-based fault localization
  found: Skipped because there is no failing per-test coverage spectrum for this static browser layout defect.
  implication: Use deterministic reproduction and direct cascade analysis.
- timestamp: 2026-08-29
  checked: common bug patterns and taxonomy
  found: Matches deterministic state/presentation mismatch; classified as Bohrbug.
  implication: A focused regression plus revert-and-reconfirm is appropriate.
- timestamp: 2026-08-29
  checked: agent-authored focused regression before the fix
  found: The tab semantics test fails because app/index.html has no author-level `[hidden]` display rule.
  implication: The test reproduces the precise cascade defect and is red before implementation.
- timestamp: 2026-08-29
  checked: focused regression and full adjacent suite after the fix
  found: Focused tab regression passes; full suite passes 64 tests with 4 hardware tests skipped and zero failures.
  implication: The fix satisfies the target contract without breaking adjacent behavior.
- timestamp: 2026-08-29
  checked: revert-and-reconfirm
  found: Removing only the `[hidden]` rule makes the focused regression fail; reapplying it makes the regression pass.
  implication: The one-line CSS change is causally responsible for the fix.
- timestamp: 2026-08-29
  checked: fix diff and mutation tooling
  found: Diff adds one behavior-preserving CSS invariant plus one assertion; no Stryker configuration or dependency exists.
  implication: No-op/deletion guard passes; mutation check is explicitly skipped.
- timestamp: 2026-08-29
  checked: final acceptance under standing user constraint
  found: Screen/UI control is forbidden; visual UAT is unavailable. The user directed acceptance from the deterministic CSS/DOM contract, red-green-revert proof, and full regression suite.
  implication: Resolve without interactive visual verification and retain this limitation in the session record.

# Eliminated


# Resolution

- root_cause: The author CSS rule `main { display: grid; }` overrides the browser's default `[hidden]` styling, so inactive main-based panels remain visible despite correct tab state.
- fix: Added one shared author-level `[hidden] { display: none !important; }` rule and a focused regression assertion in the existing tab semantics test.
- verification:
    target_test: { result: pass }
    mutation_check: { result: skipped, reason_if_skipped: "Stryker is not installed or configured", mutant_killed: null }
    no_op_deletion: { result: pass, deletion_justified_by_rca: false }
    adjacent_tests: { result: pass, suites_run: ["node --test test/transaction.test.js: 64 pass, 4 hardware skips"] }
    revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true }
    guardrail_verdict: accepted
- files_changed: [app/index.html, test/transaction.test.js]
- oracle_type: specified

# Prevention

- code branch: The generic `main` layout rule declared `display: grid`, while panel visibility relied on the lower-priority browser default for `hidden`. A shared author-level hidden rule was absent.
- environment branch: Browser CSS cascade behavior consistently gives author display declarations precedence over user-agent defaults; no browser-specific condition or source data was required.
- and_gate: no — the code branch alone caused the deterministic failure.
- why_not_caught: The existing tab semantics test checked ARIA and keyboard behavior but had no gate for the CSS visibility contract.
- recurrence_guard: `test/transaction.test.js` test `tab semantics provide archive shelf roving focus` now requires the shared author-level `[hidden]` display rule.
