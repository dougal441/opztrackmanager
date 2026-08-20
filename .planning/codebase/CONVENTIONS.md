# Coding Conventions

**Analysis Date:** 2026-08-20

## Naming Patterns

**Files:**
- Small, purpose-specific lowercase JavaScript files: `server.js`, `parser.js`, and `aif.js`; the browser UI is a single `app/index.html`.

**Functions:**
- Use lower camelCase verbs for functions (`parseProject`, `scanSlots`, `saveMeta`, `renderLibrary`). Keep helpers near the subsystem they serve in `server.js`.

**Variables:**
- Use lower camelCase for locals and parameters (`patternIndex`, `perTrack`, `source`), uppercase for module constants (`ROOT`, `PACK_TYPES`, `PATTERN_SIZE`).
- Use short names for binary-format offsets and loop indices when their scope is local (`buf`, `off`, `pb`, `i`, `t`).

**Types:**
- No TypeScript or declared classes. Data is represented by plain objects and arrays; object keys use camelCase (`usedPatterns`, `sampleRate`, `baseFreq`).

## Code Style

**Formatting:**
- Plain JavaScript with semicolons, single-quoted strings, two-space indentation, and compact one-line guards/callbacks where readable (`if (...) continue;`).
- Browser HTML, CSS, and JavaScript are co-located in `app/index.html`; there is no formatter configuration detected.

**Linting:**
- No ESLint, Biome, or other lint configuration detected. Preserve the existing Node style and explicit `'use strict';` in `server.js`, `parser.js`, and `aif.js`.

## Import Organization

**Order:**
1. Node built-ins (`http`, `fs`, `path`, `crypto`, `child_process`) in `server.js`.
2. Local modules (`./parser.js`, `./aif.js`) after built-ins.

**Path Aliases:**
- None. Use relative CommonJS `require()` for server modules.

## Error Handling

**Patterns:**
- Throw `Error` for invalid binary input or unsupported operations in `parser.js`, `aif.js`, and validation helpers in `server.js`.
- Catch expected filesystem/JSON/device absence cases locally and return a safe fallback (`loadMeta()` returns `{ songs: {} }`; scans skip unreadable entries).
- API handlers convert failures to JSON errors; browser `api()` displays `j.error` through `toast()` and rethrows for caller-level handling (`app/index.html:270-275`).

## Logging

**Framework:** console output / HTTP response diagnostics; no logging dependency detected.

**Patterns:**
- Keep normal operation quiet. Surface user-facing failures through the API response and browser toast UI rather than adding logs.

## Comments

**When to Comment:**
- Comment binary-format offsets, device/file-format assumptions, and section boundaries (`parser.js:1-16`, `aif.js:1-8`, `server.js:41-43`).
- Use section comments to divide the large server module (`// ---------- metadata ----------`).

**JSDoc/TSDoc:**
- Not used. Prefer concise inline comments for format-specific reasoning.

## Function Design

**Size:**
- Keep format helpers focused (`parseNotes`, `parseTrackChunks`, `aifToWav`); feature orchestration may remain in `server.js` handlers.

**Parameters:**
- Pass buffers and primitive identifiers directly; use plain option/request objects for multi-field operations (`api(path, body)`, backup/restore payloads).

**Return Values:**
- Return serializable plain objects/arrays for API and parser data. Return `null` when a source is unavailable (`getSource`, `scanInstruments`), and throw for malformed input.

## Module Design

**Exports:**
- Export only public parser/converter functions and constants through `module.exports` (`parser.js:119-121`, `aif.js:80-83`).

**Barrel Files:**
- None. `server.js` is the application composition root.

---

*Convention analysis: 2026-08-20*
