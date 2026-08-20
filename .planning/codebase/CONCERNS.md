# Codebase Concerns

**Analysis Date:** 2026-08-20

## Tech Debt

**Single-file HTTP server:**
- Issue: Routing, filesystem mutation, binary parsing orchestration, remote API access, and response formatting are all implemented in `server.js` (559 lines).
- Files: `server.js`
- Impact: Changes to one endpoint can affect device writes, library backups, or static serving; there is no isolated request/domain boundary.
- Fix approach: Keep the no-dependency design, but extract only the high-risk filesystem and request validation helpers when they need independent tests.

**Unbounded directory scans:**
- Issue: State loading walks several Music directories and parses every matching recording on each `/api/state` request; instrument and library scans also perform synchronous filesystem work.
- Files: `server.js:145`, `server.js:193`, `server.js:320`
- Impact: Large recording libraries or a mounted slow device block the Node event loop and make the UI request latency grow with unrelated files.
- Fix approach: Cache state briefly or scan on demand; replace synchronous recursive scans with bounded/asynchronous work if the library grows.

## Known Bugs

**Audio range requests are not validated:**
- Symptoms: A malformed `Range` header can make `m` null; negative, reversed, or past-end ranges can produce invalid stream arguments or incorrect `Content-Range` responses.
- Files: `server.js:527-537`
- Trigger: Request `/audio` with an invalid or unsatisfiable `Range` header.
- Workaround: Clients should send standard `bytes=start-end` ranges only.

**Source path containment uses string prefixes:**
- Symptoms: The checks in audio and instrument import accept paths whose textual prefix matches the base but whose resolved path is a sibling (for example, a base ending in `Music` versus `Music-other`).
- Files: `server.js:409-411`, `server.js:522-524`
- Trigger: Supply a crafted relative path or symlink through an API request.
- Workaround: Localhost-only binding reduces exposure, but containment should use `path.resolve` plus `path.relative` (and optionally realpath for symlinks).

## Security Considerations

**Unauthenticated mutating localhost API:**
- Risk: Any local process or browser page able to reach port 8765 can rename/move instrument files, overwrite OP-Z projects, restore backups, and modify settings. There is no CSRF protection or request authentication.
- Files: `server.js:314-548`
- Current mitigation: The server binds to `127.0.0.1` and does not listen on the LAN.
- Recommendations: Add an origin/token check for mutating requests and explicit slot/type bounds; retain loopback binding.

**Account token stored in application data:**
- Risk: The op1.fun email and API token are persisted in `data/settings.json` and sent in outbound request headers. The file is not protected by the app.
- Files: `data/settings.json`, `server.js:471-513`, `app/index.html:271`
- Current mitigation: The server is loopback-only; the token is not returned by the settings GET endpoint only if the UI/server behavior is changed accordingly (currently GET returns the full JSON).
- Recommendations: Do not commit `data/settings.json`; store secrets in OS keychain or an ignored local file, redact them from GET responses, and rotate the exposed token.

**Unrestricted redirect following in remote fetches:**
- Risk: `fetchText` and `fetchBuffer` follow any HTTP redirect, so a compromised upstream response can redirect the server to an arbitrary host and return its content.
- Files: `server.js:258-279`
- Current mitigation: Initial URLs are HTTPS op1.fun endpoints.
- Recommendations: Restrict redirect destinations to approved op1.fun/S3 hosts, cap redirects, and enforce response-size limits.

## Performance Bottlenecks

**Repeated full binary parsing:**
- Problem: `/api/state` reads and parses up to ten ~342KB project files, while `/api/pattern` reparses the selected project for every request.
- Files: `server.js:56-91`, `server.js:320-330`, `parser.js:76-109`
- Cause: No file-stat/hash parse cache exists.
- Improvement path: Cache parsed results keyed by path and mtime/hash; invalidate when device files change.

**Remote downloads have no size/time limit:**
- Problem: op1.fun listing and patch downloads accumulate entire responses in memory.
- Files: `server.js:258-279`, `server.js:483-513`
- Cause: `fetchText`/`fetchBuffer` have no timeout, maximum byte count, or abort handling.
- Improvement path: Add request timeouts and streaming byte ceilings before accepting remote data.

## Fragile Areas

**OP-Z binary parser assumptions:**
- Files: `parser.js:1-109`
- Why fragile: Fixed offsets, pattern size, note slot mapping, and firmware format are hard-coded; malformed/truncated data can throw from `Buffer.read*` calls.
- Safe modification: Add fixture-based bounds/format tests before changing offsets; preserve the minimum-size guard in `parseProject`.
- Test coverage: No test files or test runner detected.

**Device writes are non-atomic:**
- Files: `server.js:356-381`, `server.js:422-441`
- Why fragile: Restore and swap write directly to device files, and a process interruption between the two swap writes can leave slots inconsistent.
- Safe modification: Back up first, write temporary files in the same directory, then rename atomically where the device filesystem supports it; verify hashes afterward.
- Test coverage: No automated tests detected for backup, restore, swap, or instrument moves.

**AIFF metadata parsing:**
- Files: `aif.js:7-67`
- Why fragile: Chunk sizes and fields are trusted, only 16-bit PCM is supported, and malformed APPL JSON is silently ignored; unusual AIFF/AIFC files can throw or be misinterpreted.
- Safe modification: Validate each chunk against buffer bounds and add representative AIFF/AIFC fixtures before expanding format support.
- Test coverage: No automated tests detected.

## Scaling Limits

**In-memory WAV cache:**
- Current capacity: Up to 30 converted sample-pack buffers.
- Limit: Cache entries are full decoded WAV buffers and can consume substantial memory for long packs; eviction is count-based rather than byte-based.
- Scaling path: Track total bytes and cap memory, or stream conversion for large packs.

## Dependencies at Risk

**External op1.fun HTML/API contract:**
- Risk: Listing parsing relies on regular expressions over page markup and download parsing searches arbitrary JSON text for an `.aif` URL.
- Impact: A site markup/API change silently removes results or breaks downloads.
- Migration plan: Prefer a documented API response schema, validate host and file type, and retain a small fixture for the parser.

## Missing Critical Features

**No graceful device-change handling:**
- Problem: A device can be ejected or disconnected during scans or writes; errors become generic HTTP 500 responses.
- Blocks: Reliable unattended use and confidence that a project was safely saved.

## Test Coverage Gaps

**Core binary and filesystem workflows:**
- What's not tested: `parseProject`, `parseNotes`, AIFF conversion, path validation, range serving, backup/restore, swap, and instrument moves.
- Files: `parser.js`, `aif.js`, `server.js`
- Risk: Format regressions or destructive device/library operations can go unnoticed.
- Priority: High

---

*Concerns audit: 2026-08-20*
