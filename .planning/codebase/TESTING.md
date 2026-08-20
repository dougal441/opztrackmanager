# Testing Patterns

**Analysis Date:** 2026-08-20

## Test Framework

**Runner:**
- No test runner or test configuration detected (`package.json`, `jest.config.*`, and `vitest.config.*` are absent).

**Assertion Library:**
- None detected.

**Run Commands:**
```bash
node server.js          # Manual application smoke check
```

## Test File Organization

**Location:**
- No automated test files are present. Implementation is in `server.js`, `parser.js`, `aif.js`, and `app/index.html`.

**Naming:**
- No test naming convention exists.

**Structure:**
```text
Not detected
```

## Test Structure

**Suite Organization:**
```javascript
// No test suites detected.
```

**Patterns:**
- Verification is currently manual: launch `server.js`, open the local UI, and exercise device/local-copy, project, library, and instrument flows described in `README.md`.

## Mocking

**Framework:**
- None detected.

**Patterns:**
```javascript
// No mocking patterns detected.
```

**What to Mock:**
- Not applicable. If tests are added, isolate filesystem/device boundaries around `server.js` and use fixture buffers for `parser.js` and `aif.js`.

**What NOT to Mock:**
- Keep pure binary parsing and conversion logic real; `parseProject()` (`parser.js:87-117`) and `aifToWav()` (`aif.js:44-63`) have deterministic inputs/outputs.

## Fixtures and Factories

**Test Data:**
```text
Repository fixtures exist as real device-format files under `opzdisk/projects/*.opz` and `opzdisk/samplepacks/**/*.aif`.
```

**Location:**
- Use `opzdisk/projects/` and `opzdisk/samplepacks/` as read-only integration fixtures; no synthetic factory or fixture directory is present.

## Coverage

**Requirements:**
- None enforced; no coverage configuration or reports detected.

**View Coverage:**
```bash
Not applicable
```

## Test Types

**Unit Tests:**
- Not present. Candidate pure units are `parseChains`, `parseNotes`, `parseTrackChunks`, `parseProject` in `parser.js`, and `parseAif`, `aifToWav`, `packInfo` in `aif.js`.

**Integration Tests:**
- Not present. Manual integration uses the Node HTTP API in `server.js` against `opzdisk/` or an OP-Z mounted under `/Volumes`.

**E2E Tests:**
- Not used. Browser behavior is implemented directly in `app/index.html`.

## Common Patterns

**Async Testing:**
```javascript
// Browser code uses async/await around fetch-backed API calls.
async function load() { /* api('/api/...') */ }
```

**Error Testing:**
```javascript
// Error behavior is implicit in thrown Error instances and API JSON errors.
if (buf.length < requiredSize) throw new Error(`unexpected .opz size ${buf.length}`);
```

---

*Testing analysis: 2026-08-20*
