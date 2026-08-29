# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## top-tabs-keep-songs-visible — Inactive Songs panel remained visible beneath other top-level tabs
- **Date:** 2026-08-29
- **Error patterns:** Songs remains visible, Archive Shelf below Songs, Instruments below Songs, top-level tabs
- **Root cause(s):** The author CSS rule `main { display: grid; }` overrode the browser's default `[hidden]` styling, so inactive main-based panels remained visible despite correct tab state.
- **Fix:** Added a shared author-level `[hidden] { display: none !important; }` rule.
- **Files changed:** app/index.html, test/transaction.test.js
- **Why not caught:** The existing tab semantics test checked ARIA and keyboard behavior but had no gate for the CSS visibility contract.
- **Recurrence guard:** Regression assertion in `test/transaction.test.js`, test `tab semantics provide archive shelf roving focus`, requires the shared author-level hidden rule.
---
