# Requirements: OP-Z Manager v1.2 GitHub Product Release

**Defined:** 2026-08-30
**Core Value:** Dougal can free an OP-Z slot knowing the complete song can be verified and restored later.

## Milestone v1.2 Requirements

### Distribution

- [ ] **DIST-01**: A user can download clearly named Apple Silicon, Intel, or portable-source packages from a tagged GitHub Release.
- [ ] **DIST-02**: Apple Silicon and Intel Mac users can launch the matching self-contained OP-Z Manager app without installing Node, Homebrew, or another runtime.
- [ ] **DIST-03**: A user who prefers source can run a clean portable package with Node LTS while retaining the same functionality.
- [ ] **DIST-04**: A maintainer can reproduce every release package with one documented local command and no third-party build framework.

### Product Safety

- [ ] **SAFE-01**: Packaged apps store user data outside the application bundle, and existing source-folder users can migrate without silently losing or overwriting their library or metadata.
- [ ] **SAFE-02**: Release packages include required licenses but contain no personal settings, device projects, archives, recordings, credentials, planning artifacts, tests, or other development-only files.

### Documentation

- [ ] **DOCS-01**: A first-time user can download, install, pass the one-time macOS Privacy & Security check, and launch the app by following short plain-language instructions whose screenshots or diagrams are supplied by the project.
- [ ] **DOCS-02**: A user can understand Content Mode, device detection, songs, pattern-selected archives, full-device archives, restore, clearing, instruments, and playback from one structured user guide.
- [ ] **DOCS-03**: A user can locate and back up their data, update or remove the app, and resolve common launch, mount, port, browser, permission, and recovery problems through concise documented steps.
- [ ] **DOCS-04**: GitHub visitors can quickly understand what the product does, its hardware and macOS requirements, its safety guarantees, and which download to choose.

### Release Verification

- [ ] **REL-01**: Each build passes one automated release audit that verifies contents, licenses, checksums, the existing local tests, and rejection of forbidden files.
- [ ] **REL-02**: Fresh-install and update checks prove that the packaged app serves the same interface, detects the supported OP-Z or fallback source, and preserves external user data.

### GitHub Project

- [ ] **GHUB-01**: The public repository follows the researched lightweight GitHub practice with a product-focused README, MIT license, support, security, contribution, and privacy-safe bug-report guidance.
- [ ] **GHUB-02**: A release is prepared as a draft, supplied with verified assets and useful release notes, and published only after its documented package checks pass.

## Future Requirements

### Distribution Convenience

- **DIST-05**: Users can install a Developer ID-signed and notarized app without a Gatekeeper override if project ownership later chooses Apple Developer membership.
- **DIST-06**: Homebrew users can install and update OP-Z Manager through a maintained tap if demand justifies the extra release surface.
- **DIST-07**: Users can receive automatic update notifications if manual GitHub Release updates become a demonstrated problem.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Apple Developer signing and notarization | Requires paid program membership and a formal credential workflow the owner explicitly does not want |
| Mac App Store distribution | Requires developer membership, review, sandbox work, and ongoing store administration |
| DMG or PKG installer | Adds packaging machinery without removing Gatekeeper requirements |
| Homebrew tap | Useful later, but maintaining another distribution repository is unnecessary for the first public package |
| Windows or Linux support | Device discovery and launcher behavior are intentionally macOS-specific |
| Docker distribution | Adds setup and mounted-device complexity while degrading the local Mac experience |
| Browser-only rewrite | Browser filesystem restrictions cannot preserve current device and archive behavior without a local server |
| Automatic updater | Manual GitHub downloads are sufficient for an informal open-source release |
| Product or UI redesign | This milestone packages and documents the already verified experience without changing functionality |
| GitHub Actions build provenance | Add when GitHub Actions owns repeatable releases; a new remote build system is unnecessary for this locally built release |
| Code of conduct | Add if a contributor community forms and the owner is ready to enforce it |

## Traceability

Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|

**Coverage:**
- v1.2 requirements: 14 total
- Mapped to phases: 0
- Unmapped: 14

---
*Requirements defined: 2026-08-30*
*Last updated: 2026-08-30 after approved milestone scoping and GitHub distribution research*
