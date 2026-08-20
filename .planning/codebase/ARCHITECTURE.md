<!-- refreshed: 2026-08-20 -->
# Architecture

**Analysis Date:** 2026-08-20

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│ Browser UI                                                   │
│ `app/index.html` (HTML/CSS/vanilla JavaScript)               │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP JSON/audio requests
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Local Node HTTP server                                       │
│ `server.js` — routing, scans, mutations, static files       │
└───────────────┬───────────────────┬─────────────────────────┘
                │                   │
                ▼                   ▼
┌────────────────────────┐  ┌────────────────────────────────┐
│ Format adapters         │  │ Filesystem sources             │
│ `parser.js`, `aif.js`   │  │ `/Volumes/*`, `opzdisk/`,      │
│ OP-Z binary + AIFF      │  │ `library/`, `data/`, recordings │
└────────────────────────┘  └────────────────────────────────┘
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

**Overall:** Single-process local web application with a thin vanilla-JS client and filesystem-backed Node API.

**Key Characteristics:**
- No package manifest or runtime framework; `server.js` uses Node built-ins (`http`, `fs`, `path`, `https`, `crypto`).
- API handlers call parsing and filesystem helpers directly; there is no separate controller/service/repository layer.
- Device access is selected dynamically: `OPZ_ROOT`, mounted macOS volumes, then `opzdisk/` fallback (`server.js:41-64`).
- All state is derived by rescanning files for `/api/state`; mutable user annotations are stored separately by project content hash.

## Layers

**Presentation:**
- Purpose: Render the manager and issue fetch requests.
- Location: `app/index.html`
- Contains: Inline markup, CSS, DOM rendering, WebAudio playback, and API client functions.
- Depends on: `/api/state`, `/api/pattern`, mutation routes, `/audio`.

**HTTP/application:**
- Purpose: Translate requests into scans, parser calls, file copies/moves, and responses.
- Location: `server.js`
- Contains: Source detection, slot/library/instrument/recording scanners, API route dispatch, static serving, range audio streaming.
- Depends on: Node standard library, `parser.js`, `aif.js`, local/device filesystem, op1.fun HTTPS endpoints.

**Format adapters:**
- Purpose: Isolate binary format interpretation and browser conversion.
- Location: `parser.js`, `aif.js`
- Contains: Fixed-offset OP-Z project parsing and AIFF/AIFC chunk parsing/WAV encoding.
- Used by: `server.js` and, indirectly, the browser API.

**Storage:**
- Purpose: Hold source projects, instruments, metadata, recordings, and backups.
- Locations: `opzdisk/`, mounted device root, `data/`, `library/`, `bounces/`.

## Data Flow

### Primary State Request

1. Browser loads `/` and inline client calls `load()` (`app/index.html:270-281`).
2. `GET /api/state` loads `data/meta.json`, scans ten project slots, library bundles, recordings, and sample-pack grid (`server.js:317-324`).
3. `scanSlots()` reads each `.opz`, hashes it, and passes bytes to `parseProject()` (`server.js:66-92`, `parser.js:89-118`).
4. JSON returns to the browser, which renders the Songs and Instruments views (`app/index.html:291-304`).

### Song Backup/Restore

1. UI posts `/api/backup` or `/api/restore` with slot/library selection (`app/index.html`).
2. Server resolves the source with `projFile()`, copies `song.opz`, writes `info.json`, and optionally copies `samplepacks/` (`server.js:342-373`).
3. Restore first creates an automatic bundle in `library/auto-backups/`, then replaces the target project and optionally instruments.

### Pattern Sketch Playback

1. UI requests `/api/pattern?slot=&pattern=`.
2. Server parses tempo, note events, and track chunks using `parser.js` and returns JSON (`server.js:326-330`).
3. Browser schedules generic or selected sample sounds with WebAudio and can stream recordings through `/audio`.

**State Management:** Files are the source of truth; `STATE` and `SETTINGS` are in-memory browser snapshots refreshed by `load()`. `data/meta.json` is the only hash-keyed annotation store.

## Key Abstractions

**Source descriptor:** `getSource()` returns `{root, path, device, label}` and centralizes device/local routing (`server.js:55-64`).

**Project hash identity:** `hashFile()` creates a short MD5 identity used to attach metadata independent of slot (`server.js:36`, `data/meta.json`).

**Library bundle:** A directory containing `song.opz`, `info.json`, and optional `samplepacks/`, scanned by `scanLibrary()` (`server.js:147-183`).

**Parser exports:** `parseProject`, `parseNotes`, and `parseTrackChunks` are the stable format boundary (`parser.js:121`).

## Entry Points

**Desktop launch:** `Start OP-Z Manager.command` changes to the repo and runs `node server.js`.

**Node server:** `server.js:551-559` binds `127.0.0.1:8765` and opens the browser on macOS.

**Browser root:** `server.js:542-548` maps `/` to `app/index.html`.

## Architectural Constraints

- **Threading:** Single Node event loop; synchronous filesystem scans/copies run inside request handlers.
- **Global state:** Module-level paths/constants and one HTTP server in `server.js`; browser state is held in globals in `app/index.html`.
- **Circular imports:** None detected; `server.js` depends one-way on `parser.js` and `aif.js`.
- **Platform:** Device discovery and auto-open assume macOS (`/Volumes`, `open`); local fallback supports operation without hardware.
- **Protocol:** OP-Z project parsing relies on fixed binary offsets and expected minimum size in `parser.js`.

## Anti-Patterns

### Monolithic request module

**What happens:** Routing, domain logic, storage, and integrations share `server.js`.
**Why it's wrong:** Changes can affect unrelated routes and synchronous work blocks the local server.
**Do this instead:** Keep additions in the existing helper/route sections unless a genuinely reused boundary is needed; preserve `parser.js`/`aif.js` as format boundaries.

### Inline frontend application

**What happens:** All UI markup, CSS, and JavaScript live in `app/index.html`.
**Why it's wrong:** The file is large and cross-view changes are harder to isolate.
**Do this instead:** For small changes follow the existing inline patterns; split assets only when independent reuse or maintainability justifies it.

## Error Handling

**Strategy:** Route-level `try/catch` converts failures to HTTP 500 JSON; individual scans often skip malformed/unreadable entries and continue (`server.js:313-558`). Input/body checks return 400 JSON for known invalid operations.

**Patterns:** `loadMeta()` and optional info/settings reads fall back to empty objects; parser failures become per-slot `error` entries; path validation protects `/audio` and static serving.

## Cross-Cutting Concerns

**Logging:** Startup status only, via `console.log` in `server.js:551-559`.
**Validation:** Small local helpers (`safeName`, `packSlotDir`, path checks) and route-specific checks in `server.js`.
**Authentication:** No local auth; server binds loopback. op1.fun download uses credentials loaded from `data/settings.json` for outbound API headers.

---

*Architecture analysis: 2026-08-20*
