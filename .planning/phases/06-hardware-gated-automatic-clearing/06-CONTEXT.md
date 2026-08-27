# Phase 6 Context: Hardware-Gated Automatic Clearing

## Decisions

- **D-01 — One clear method:** Automatic clearing uses only deletion of the captured `projects/projectNN.opz` file in Content Mode. No alternate template, firmware command, or heuristic is eligible.
- **D-02 — Complete acceptance gate:** The method remains disabled unless a versioned record proves the exact method passed the local fixture test and all required sacrificial-device outcomes, including eject, reconnect, and confirmed post-reconnect empty-slot state.
- **D-03 — Archive first:** Every automatic clear captures and verifies the complete archive before deleting anything; the verified recovery archive is retained regardless of clear confirmation.
- **D-04 — Pinned source and fail-closed mutation:** The clear transaction uses one captured source identity, slot fingerprint, and source token. Source loss or replacement stops the transaction and never resolves `opzdisk/` as a substitute.
- **D-05 — Recovery on uncertainty:** If deletion, reconnect confirmation, or final state verification cannot be confirmed, the API returns a non-success result with the retained recovery reference and explicit reconnect/restore instructions; automatic clearing stays unavailable.

## Boundaries

- The local fixture implementation and tests may be completed without an OP-Z.
- Real-device acceptance is direct API/filesystem UAT only: no browser automation, screen control, or computer-use workflow.
- Manual device clearing remains the user-facing fallback until D-02 is satisfied.
- Do not add dependencies, a build step, alternate clear strategies, or speculative abstractions.
