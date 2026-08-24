<!-- GSD:project-start source:PROJECT.md -->

## Project

**OP-Z Manager**

OP-Z Manager is a zero-configuration macOS librarian for Dougal's Teenage Engineering OP-Z. It shows and annotates the ten device project slots, previews songs, manages sample packs, and keeps an unlimited laptop library so a slot can be freed without losing the complete song.

The first milestone turns the existing backup features into a trustworthy archive-and-restore workflow and correctly handles projects that contain two songs split across different pattern ranges.

**Core Value:** Dougal can free an OP-Z slot knowing the complete song can be verified and restored later.

### Constraints

- **Safety**: Preserve automatic backup before every destructive operation; nothing the app does may make user data unrecoverable
- **Verification**: A backup is not complete until stored bytes are checked and the stored `.opz` parses successfully
- **Hardware**: Automatic slot clearing and synthesized split projects require real-device validation after local fixture tests
- **Stack**: Keep the no-dependency Node.js and browser-native architecture; add no build step or package install
- **Usability**: Double-click-and-go on macOS, with no developer setup beyond Node.js
- **Compatibility**: Current features operate in OP-Z disk mode and must still work against the `opzdisk/` fallback
- **Device writes**: Handle a disappearing mount safely and never continue a multi-step mutation after source validity is lost
- **Secrets**: Do not commit or expose op1.fun credentials from `data/settings.json`

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- JavaScript (CommonJS, strict mode) - local HTTP server, OP-Z binary/AIFF parsing, filesystem operations in `server.js`, `parser.js`, and `aif.js`.
- HTML/CSS/JavaScript - single-page browser UI in `app/index.html`.
- Bash - macOS launcher in `Start OP-Z Manager.command`.

## Runtime

- Node.js (version not pinned; README requires Node installed via Homebrew) - local server runtime.
- Modern browser - Web Audio sketch playback and UI.
- None detected; `server.js` explicitly uses no dependencies.
- Lockfile: missing/not applicable.

## Frameworks

- Node.js built-in `http` server - API and static-file serving in `server.js`.
- Browser Web Audio API - sketch playback in `app/index.html`.
- Not detected.
- None; run directly with `node server.js` or `Start OP-Z Manager.command`.

## Key Dependencies

- Node built-ins `fs`, `path`, `crypto`, `http`, `https`, and `child_process` - storage, parsing support, HTTP integration, hashing, and macOS browser launch (`server.js`).
- No third-party npm packages detected.
- OP-Z `.opz` binary format parser (`parser.js`).
- AIFF/AIFC and OP-1 metadata parser plus WAV conversion (`aif.js`).

## Configuration

- `OPZ_ROOT` optionally overrides device-root detection when it contains `projects/` (`server.js`).
- `NO_OPEN` disables macOS `open http://localhost:8765` startup behavior (`server.js`).
- `data/settings.json` stores persisted op1.fun account settings; treat it as sensitive configuration.
- `Contents/Info.plist` is an existing macOS application bundle metadata file (Unity-generated metadata); the active manager entry point remains `server.js`.
- No transpiler, bundler, formatter, or compiler configuration detected.

## Platform Requirements

- macOS is the documented target: `/Volumes` device discovery and `open` browser launch are macOS-specific (`server.js`).
- Node.js and a browser; an OP-Z in disk mode is optional because `opzdisk/` is the local-copy fallback.
- Local-only process bound to `127.0.0.1:8765`; no hosted deployment target detected.

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- Small, purpose-specific lowercase JavaScript files: `server.js`, `parser.js`, and `aif.js`; the browser UI is a single `app/index.html`.
- Use lower camelCase verbs for functions (`parseProject`, `scanSlots`, `saveMeta`, `renderLibrary`). Keep helpers near the subsystem they serve in `server.js`.
- Use lower camelCase for locals and parameters (`patternIndex`, `perTrack`, `source`), uppercase for module constants (`ROOT`, `PACK_TYPES`, `PATTERN_SIZE`).
- Use short names for binary-format offsets and loop indices when their scope is local (`buf`, `off`, `pb`, `i`, `t`).
- No TypeScript or declared classes. Data is represented by plain objects and arrays; object keys use camelCase (`usedPatterns`, `sampleRate`, `baseFreq`).

## Code Style

- Plain JavaScript with semicolons, single-quoted strings, two-space indentation, and compact one-line guards/callbacks where readable (`if (...) continue;`).
- Browser HTML, CSS, and JavaScript are co-located in `app/index.html`; there is no formatter configuration detected.
- No ESLint, Biome, or other lint configuration detected. Preserve the existing Node style and explicit `'use strict';` in `server.js`, `parser.js`, and `aif.js`.

## Import Organization

- None. Use relative CommonJS `require()` for server modules.

## Error Handling

- Throw `Error` for invalid binary input or unsupported operations in `parser.js`, `aif.js`, and validation helpers in `server.js`.
- Catch expected filesystem/JSON/device absence cases locally and return a safe fallback (`loadMeta()` returns `{ songs: {} }`; scans skip unreadable entries).
- API handlers convert failures to JSON errors; browser `api()` displays `j.error` through `toast()` and rethrows for caller-level handling (`app/index.html:270-275`).

## Logging

- Keep normal operation quiet. Surface user-facing failures through the API response and browser toast UI rather than adding logs.

## Comments

- Comment binary-format offsets, device/file-format assumptions, and section boundaries (`parser.js:1-16`, `aif.js:1-8`, `server.js:41-43`).
- Use section comments to divide the large server module (`// ---------- metadata ----------`).
- Not used. Prefer concise inline comments for format-specific reasoning.

## Function Design

- Keep format helpers focused (`parseNotes`, `parseTrackChunks`, `aifToWav`); feature orchestration may remain in `server.js` handlers.
- Pass buffers and primitive identifiers directly; use plain option/request objects for multi-field operations (`api(path, body)`, backup/restore payloads).
- Return serializable plain objects/arrays for API and parser data. Return `null` when a source is unavailable (`getSource`, `scanInstruments`), and throw for malformed input.

## Module Design

- Export only public parser/converter functions and constants through `module.exports` (`parser.js:119-121`, `aif.js:80-83`).
- None. `server.js` is the application composition root.

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Launch wrapper | Starts the local Node process from the project directory | `Start OP-Z Manager.command` |
| HTTP application | Serves UI and owns all API routes, filesystem operations, source detection, and external requests | `server.js` |
| OP-Z parser | Decodes project header, chains, patterns, notes, and track chunks | `parser.js` |
| AIFF adapter | Reads OP-1/OP-Z metadata and converts 16-bit AIFF/AIFC samples to browser WAV | `aif.js` |
| Browser client | Renders slots, library, instruments, pack browser, metadata editors, and WebAudio sketches | `app/index.html` |
| Project source | Device disk or local fallback project files | `/Volumes/<device>/projects`, `opzdisk/projects` |
| Persistent metadata | Hash-keyed song names, tags, notes, recording links, and kit selections | `data/meta.json` |
| Library | Song bundles, automatic restore backups, and instrument trash/snapshots | `library/` |

## Pattern Overview

- No package manifest or runtime framework; `server.js` uses Node built-ins (`http`, `fs`, `path`, `https`, `crypto`).
- API handlers call parsing and filesystem helpers directly; there is no separate controller/service/repository layer.
- Device access is selected dynamically: `OPZ_ROOT`, mounted macOS volumes, then `opzdisk/` fallback (`server.js:41-64`).
- All state is derived by rescanning files for `/api/state`; mutable user annotations are stored separately by project content hash.

## Layers

- Purpose: Render the manager and issue fetch requests.
- Location: `app/index.html`
- Contains: Inline markup, CSS, DOM rendering, WebAudio playback, and API client functions.
- Depends on: `/api/state`, `/api/pattern`, mutation routes, `/audio`.
- Purpose: Translate requests into scans, parser calls, file copies/moves, and responses.
- Location: `server.js`
- Contains: Source detection, slot/library/instrument/recording scanners, API route dispatch, static serving, range audio streaming.
- Depends on: Node standard library, `parser.js`, `aif.js`, local/device filesystem, op1.fun HTTPS endpoints.
- Purpose: Isolate binary format interpretation and browser conversion.
- Location: `parser.js`, `aif.js`
- Contains: Fixed-offset OP-Z project parsing and AIFF/AIFC chunk parsing/WAV encoding.
- Used by: `server.js` and, indirectly, the browser API.
- Purpose: Hold source projects, instruments, metadata, recordings, and backups.
- Locations: `opzdisk/`, mounted device root, `data/`, `library/`, `bounces/`.

## Data Flow

### Primary State Request

### Song Backup/Restore

### Pattern Sketch Playback

## Key Abstractions

## Entry Points

## Architectural Constraints

- **Threading:** Single Node event loop; synchronous filesystem scans/copies run inside request handlers.
- **Global state:** Module-level paths/constants and one HTTP server in `server.js`; browser state is held in globals in `app/index.html`.
- **Circular imports:** None detected; `server.js` depends one-way on `parser.js` and `aif.js`.
- **Platform:** Device discovery and auto-open assume macOS (`/Volumes`, `open`); local fallback supports operation without hardware.
- **Protocol:** OP-Z project parsing relies on fixed binary offsets and expected minimum size in `parser.js`.

## Anti-Patterns

### Monolithic request module

### Inline frontend application

## Error Handling

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `$gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `$gsd-debug` for investigation and bug fixing
- `$gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `$gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
