---
phase: 01-verified-transaction-foundation
reviewed: 2026-08-25T13:20:15Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - server.js
  - app/index.html
  - test/transaction.test.js
findings:
  critical: 5
  warning: 2
  info: 0
  total: 7
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-08-25T13:20:15Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

The archive transaction has useful project-byte checks, but it does not yet establish the advertised integrity of deep archives. The review also reproduced a one-request server crash in audio range handling and found two direct credential-exposure paths. Corrupted published bundles can disappear from the UI, and the metadata boundary accepts values that later code cannot safely consume. The focused transaction tests pass (16 passed, 1 hardware test skipped), but they do not exercise deep archive integrity.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: [BLOCKER] Deep archives are marked verified without verifying sample-pack bytes

**File:** `/Users/dougalhanson/Documents/Claude/Projects/Music/Music/opzgui/server.js:463-479`
**Issue:** A deep archive recursively copies `samplepacks/`, but verification hashes and rereads only `song.opz`. `scanLibrary()` also derives `verified` solely from the project file at lines 177-187. The copied instruments are therefore outside the verification contract even though the UI labels the archive `full` and `verified`. This was reproduced by creating a deep archive, corrupting its copied `.aif`, and observing `scanLibrary(...)[0].verified === true`. A source pack can also change between `copyDir()` and `instrumentsSummary()`, producing metadata for a different instrument set than the stored bytes.
**Fix:** Build a manifest while copying deep content, then reread every destination file and compare its byte count and SHA-256 before publication. Store the manifest in `info.json`, require it when `deep === true`, and make `scanLibrary()` revalidate it before returning `verified: true`. Derive the instrument summary from the verified destination snapshot, not the live source.

### CR-02: [BLOCKER] An invalid byte range crashes the entire local server

**File:** `/Users/dougalhanson/Documents/Claude/Projects/Music/Music/opzgui/server.js:729-736`
**Issue:** Range syntax and bounds are not validated before sending a `206` response. A request with a start beyond the file size makes stream construction throw after headers have been written; the outer catch then calls `json()`, which writes headers a second time and terminates Node with `ERR_HTTP_HEADERS_SENT`. This was reproduced with `Range: bytes=999999999999-` against an existing bounce. Any local client can take down the manager with one request.
**Fix:** Parse the complete single-range grammar, reject malformed, reversed, or out-of-bounds ranges with `416` and `Content-Range: bytes */<size>` before `writeHead()`, clamp a valid end to `size - 1`, and attach an error handler (or use `stream.pipeline`) so post-header read failures close the response instead of reaching the JSON catch.

### CR-03: [BLOCKER] The settings API returns the stored op1.fun token in plaintext

**File:** `/Users/dougalhanson/Documents/Claude/Projects/Music/Music/opzgui/server.js:689-703`
**Issue:** `GET /api/settings` serializes all of `data/settings.json`, including `op1funToken`, to any process able to connect to the loopback port. The browser then puts that returned secret into a visible text field at `app/index.html:240-241,299-333`. This bypasses filesystem ownership protections and violates the project rule not to expose op1.fun credentials.
**Fix:** Return only non-secret state such as `{ op1funEmail, hasOp1funToken }`; never echo the token. Use `type="password"` with a blank value and update the stored token only when the user submits a replacement (plus an explicit clear action if needed). Add `Cache-Control: no-store` to settings responses.

### CR-04: [BLOCKER] Newly saved credentials are readable by other local users

**File:** `/Users/dougalhanson/Documents/Claude/Projects/Music/Music/opzgui/server.js:703`
**Issue:** `writeFileSync()` creates `data/settings.json` using the process umask and never tightens an existing file. In the reviewed workspace the file is `-rw-r--r--`, so any local account can read the op1.fun token. This is a concrete secret disclosure, not a hypothetical style concern.
**Fix:** Create/write the settings file with mode `0o600` and call `fs.chmodSync(SETTINGS_FILE, 0o600)` for existing installations. Prefer writing a user-only temporary file and renaming it so credential updates cannot leave a truncated file.

### CR-05: [BLOCKER] Corrupted published archives silently disappear instead of becoming diagnostics

**File:** `/Users/dougalhanson/Documents/Claude/Projects/Music/Music/opzgui/server.js:170-200`
**Issue:** `scanLibrary()` swallows every bundle scan failure. An evidence mismatch is shown as unverified only while `song.opz` still parses; truncation, read errors, or parser rejection cause the whole archive to vanish from state and from the UI. A user cannot distinguish corruption from “no backup,” undermining the trustworthy archive requirement and hiding damage that needs attention.
**Fix:** When a directory contains `song.opz`, catch parse/read failures into a sanitized item such as `{ file, bundle: true, verified: false, errorCode: 'ARCHIVE_PARSE_FAILED' }`. Keep paths and raw parser messages private, but always surface the bundle in the existing unverified diagnostics section.

## Warnings

### WR-01: [WARNING] Metadata validation accepts shapes that downstream code cannot consume

**File:** `/Users/dougalhanson/Documents/Claude/Projects/Music/Music/opzgui/server.js:613-625`
**Issue:** The endpoint accepts arbitrary field names and any non-string JSON values. For example, an object or number can be stored as `name`; a later backup with an empty submitted name passes that value to `safeName()`, which calls `.replace()` and fails. Invalid `kit`, `wav`, and other shapes likewise flow into browser rendering and audio paths. The 20 KB serialization limit does not provide schema safety.
**Fix:** Whitelist supported metadata keys and validate each expected type: bounded strings for `name`, `tags`, `notes`, `wav`, and `wavMatch`; and a plain `kit` object containing only known track keys with integer slots 1-10. Reject unknown or invalid fields with `INVALID_METADATA`, and normalize `loadMeta()` to `{ songs: {} }` when the persisted top-level shape is invalid.

### WR-02: [WARNING] Transaction tests never exercise deep archive verification

**File:** `/Users/dougalhanson/Documents/Claude/Projects/Music/Music/opzgui/test/transaction.test.js:79-125`
**Issue:** The integrity tests archive only with `deep: false`, so the suite passes while copied instrument bytes are completely outside verification. This makes the green test result unreliable for the UI's “full” archive promise.
**Fix:** Add one temporary-root test with `deep: true` and a sample-pack file. Assert the published manifest covers the pack, destination corruption changes the library item to `verified: false`, and a source change during capture prevents publication.

---

_Reviewed: 2026-08-25T13:20:15Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
