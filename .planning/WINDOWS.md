---
schema_version: 1
open_count: 0
waived_count: 0
fixed_count: 2
total_count: 2
last_updated: 2026-08-25T13:02:49.757Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | deviation | test/transaction.test.js |  | Canonicalize macOS temporary paths in containment assertions | fixed |  | 2026-08-25T13:02:34.988Z | 2026-08-25T13:02:49.634Z |
| 2 | 01 | deviation | test/transaction.test.js |  | Pin HTTP state checks to temporary fixture roots instead of mounted hardware | fixed |  | 2026-08-25T13:02:35.109Z | 2026-08-25T13:02:49.757Z |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "01",
    "file": "test/transaction.test.js",
    "line": null,
    "description": "Canonicalize macOS temporary paths in containment assertions",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-25T13:02:34.988Z",
    "resolved_at": "2026-08-25T13:02:49.634Z"
  },
  {
    "id": 2,
    "kind": "deviation",
    "phase": "01",
    "file": "test/transaction.test.js",
    "line": null,
    "description": "Pin HTTP state checks to temporary fixture roots instead of mounted hardware",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-25T13:02:35.109Z",
    "resolved_at": "2026-08-25T13:02:49.757Z"
  }
]
````
