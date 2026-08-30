# GitHub Distribution Research

**Researched:** 2026-08-30
**Scope:** Informal public distribution of a small downloadable macOS utility

## Adopt for v1.2

- Publish each version as a tagged GitHub Release with release notes and clearly named binary assets. GitHub Releases are the supported place to bundle deployable software, notes, and binary downloads.
- Prepare the release as a draft, attach and verify every asset, then publish. This is also GitHub's recommended sequence when immutable releases are enabled.
- Make the root README the product landing page: explain why the app is useful, who it is for, requirements, download choice, setup, and links to the full guide.
- Retain the existing MIT `LICENSE` and add concise `SUPPORT.md`, `SECURITY.md`, and `CONTRIBUTING.md` files so GitHub surfaces the correct help, vulnerability-reporting, and contribution paths.
- Add one focused bug-report issue form that asks for macOS, Mac architecture, OP-Z mode, package type, and reproducible steps while warning users not to attach settings, projects, archives, recordings, or credentials.
- Publish SHA-256 checksums beside the assets and verify them before upload. Checksums are a lightweight integrity aid appropriate to a locally built hobby release.

## Deliberately Skip

- **Code of conduct:** GitHub recommends adding one only after considering whether the maintainer is willing and able to enforce it. Add if a real contributor community forms.
- **GitHub Actions build pipeline and artifact attestations:** Attestations are valuable when GitHub Actions owns the build, but adding a remote build system solely for provenance would exceed this milestone's one-command local packaging goal. Add when releases become frequent or have multiple maintainers.
- **Protected tags, automated dependency review, release automation, and a separate project website:** no current maintenance or dependency problem justifies them.
- **GitHub's automatic source ZIP as the user package:** it contains the repository rather than the curated product. Attach a purpose-built portable source ZIP; leave automatic archives available for developers.

## Sources

- GitHub, [About releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)
- GitHub, [Managing releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)
- GitHub, [About READMEs](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes)
- GitHub, [Community profiles for public repositories](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/about-community-profiles-for-public-repositories)
- GitHub, [Support resources](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/adding-support-resources-to-your-project)
- GitHub, [Contribution guidelines](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/setting-guidelines-for-repository-contributors)
- GitHub, [Artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations)

