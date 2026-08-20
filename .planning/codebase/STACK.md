# Technology Stack

**Analysis Date:** 2026-08-20

## Languages

**Primary:**
- JavaScript (CommonJS, strict mode) - local HTTP server, OP-Z binary/AIFF parsing, filesystem operations in `server.js`, `parser.js`, and `aif.js`.
- HTML/CSS/JavaScript - single-page browser UI in `app/index.html`.

**Secondary:**
- Bash - macOS launcher in `Start OP-Z Manager.command`.

## Runtime

**Environment:**
- Node.js (version not pinned; README requires Node installed via Homebrew) - local server runtime.
- Modern browser - Web Audio sketch playback and UI.

**Package Manager:**
- None detected; `server.js` explicitly uses no dependencies.
- Lockfile: missing/not applicable.

## Frameworks

**Core:**
- Node.js built-in `http` server - API and static-file serving in `server.js`.
- Browser Web Audio API - sketch playback in `app/index.html`.

**Testing:**
- Not detected.

**Build/Dev:**
- None; run directly with `node server.js` or `Start OP-Z Manager.command`.

## Key Dependencies

**Critical:**
- Node built-ins `fs`, `path`, `crypto`, `http`, `https`, and `child_process` - storage, parsing support, HTTP integration, hashing, and macOS browser launch (`server.js`).
- No third-party npm packages detected.

**Infrastructure:**
- OP-Z `.opz` binary format parser (`parser.js`).
- AIFF/AIFC and OP-1 metadata parser plus WAV conversion (`aif.js`).

## Configuration

**Environment:**
- `OPZ_ROOT` optionally overrides device-root detection when it contains `projects/` (`server.js`).
- `NO_OPEN` disables macOS `open http://localhost:8765` startup behavior (`server.js`).
- `data/settings.json` stores persisted op1.fun account settings; treat it as sensitive configuration.

**Build:**
- `Contents/Info.plist` is an existing macOS application bundle metadata file (Unity-generated metadata); the active manager entry point remains `server.js`.
- No transpiler, bundler, formatter, or compiler configuration detected.

## Platform Requirements

**Development:**
- macOS is the documented target: `/Volumes` device discovery and `open` browser launch are macOS-specific (`server.js`).
- Node.js and a browser; an OP-Z in disk mode is optional because `opzdisk/` is the local-copy fallback.

**Production:**
- Local-only process bound to `127.0.0.1:8765`; no hosted deployment target detected.

---

*Stack analysis: 2026-08-20*
