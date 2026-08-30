# Roadmap: OP-Z Manager

## Overview

Milestone v1.2 turns the verified local manager into a safe GitHub product in two steps: first produce clean, reproducible Mac and source packages whose data survives replacement, then give users the guidance and checked GitHub Release needed to choose, run, and support the product.

## Milestones

- ✅ **v1.0 Trustworthy Library** — Phases 1–6 (shipped 2026-08-29; [archive](milestones/v1.0-ROADMAP.md))
- ✅ **v1.1 Unified Songs** — Phases 7–8 (shipped 2026-08-29)
- 🚧 **v1.2 GitHub Product Release** — Phases 9–10 (in progress)

## Phases

- [ ] **Phase 9: Safe Release Packages** - Produce self-contained Mac apps and a clean source package with external, migration-safe user data and repeatable audits.
- [ ] **Phase 10: Documented GitHub Release** - Make the product understandable and stage a verified draft release with every supported download.

## Phase Details

### Phase 9: Safe Release Packages

**Goal**: Mac and source users can run equivalent clean packages while their existing or new user data remains safe outside replaceable application files.
**Depends on**: Phase 8
**Requirements**: DIST-02, DIST-03, DIST-04, SAFE-01, SAFE-02, REL-01, REL-02
**Success Criteria** (what must be TRUE):

1. Apple Silicon and Intel users can launch the matching self-contained app without installing Node, Homebrew, or another runtime, while a source-package user can run the same manager behavior with Node LTS.
2. Fresh installs and updates preserve external archives, metadata, and settings, and existing source-folder data migrates without silent loss or overwrite.
3. One documented local command reproducibly creates all release packages without a third-party build framework.
4. One automated audit runs the existing tests, checks package contents, licenses, and checksums, rejects forbidden personal or development files, and proves each package serves the manager and detects an OP-Z or fallback source.

**Plans**: 1 plan

Plans:
- [ ] 09-01: Package both Mac architectures and portable source, externalize user data safely, and audit the resulting release assets.

### Phase 10: Documented GitHub Release

**Goal**: A first-time GitHub visitor can choose, install, use, support, update, and remove OP-Z Manager from a checked draft release without exposing private data.
**Depends on**: Phase 9
**Requirements**: DIST-01, DOCS-01, DOCS-02, DOCS-03, DOCS-04, GHUB-01, GHUB-02
**Success Criteria** (what must be TRUE):

1. A GitHub visitor can quickly understand the product, supported hardware and macOS requirements, safety guarantees, and which clearly named Apple Silicon, Intel, or portable-source download to choose.
2. A first-time user can follow supplied plain-language instructions and visuals to install, pass the one-time macOS Privacy & Security check, launch, and use every documented manager workflow.
3. A user can find and back up their data, update or remove the product, and resolve common launch, mount, port, browser, permission, and recovery problems from the supplied guide.
4. The public repository provides concise support, security, contribution, license, and privacy-safe bug-report guidance, and a draft tagged release contains verified assets, checksums, and useful notes ready to publish only after its documented checks pass.

**Plans**: 1 plan

Plans:
- [ ] 10-01: Write the product and user guidance, add lightweight GitHub support files, and prepare the checked draft release.

## Progress

**Execution Order:** Phase 9 → Phase 10

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 9. Safe Release Packages | v1.2 | 0/1 | Not started | - |
| 10. Documented GitHub Release | v1.2 | 0/1 | Not started | - |
