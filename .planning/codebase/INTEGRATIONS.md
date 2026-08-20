# External Integrations

**Analysis Date:** 2026-08-20

## APIs & External Services

**Community sample packs:**
- op1.fun - browses public patch HTML and downloads `.aif` packs through the pack browser (`server.js`, `app/index.html`).
  - SDK/Client: Node built-in `https`; HTML parsed with local regex logic in `parseOp1FunListing` (`server.js`).
  - Auth: persisted `op1funEmail` and `op1funToken` fields in `data/settings.json`, sent as `X-User-Email` and `X-User-Token` to `https://api.op1.fun/v1/users/...`.
- op1.fun preview assets - browser loads preview MP3 URLs discovered from listing HTML, typically hosted on `op1fun.s3.amazonaws.com` (`server.js`, `app/index.html`).

## Data Storage

**Databases:**
- None. JSON files are used for metadata and settings: `data/meta.json`, `data/settings.json`.

**File Storage:**
- Local filesystem only: `library/`, `library/auto-backups/`, and `library/instrument-trash/` (`server.js`).
- Removable OP-Z filesystem in disk mode: `/Volumes/<device>/projects` and `/Volumes/<device>/samplepacks`, or `OPZ_ROOT` (`server.js`).
- Bundled local fallback: `opzdisk/projects` and `opzdisk/samplepacks` (`server.js`, `README.md`).
- Local recordings are scanned from `OP-Z songs`, `bounces`, and `FlowStudio/Recordings` relative to the music project (`server.js`).

**Caching:**
- In-memory WAV conversion cache (`global.__wavCache`) capped at 30 entries (`server.js`).

## Authentication & Identity

**Auth Provider:**
- op1.fun account credentials only; there is no local user authentication for the localhost UI (`server.js`, `data/settings.json`).

## Monitoring & Observability

**Error Tracking:**
- None detected.

**Logs:**
- Startup status is printed to stdout; API failures return JSON `{ error }` with HTTP 500 (`server.js`).
- OP-Z import artifacts include `opzdisk/import.log`; no structured logging pipeline detected.

## CI/CD & Deployment

**Hosting:**
- None. The server is local-only and binds to `127.0.0.1:8765` (`server.js`).

**CI Pipeline:**
- None detected.

## Environment Configuration

**Required env vars:**
- None required for local-copy mode.
- Optional `OPZ_ROOT` selects a mounted/device-compatible root; optional `NO_OPEN` suppresses browser launch (`server.js`).
- op1.fun download requires account fields in `data/settings.json`; values are not duplicated here.

**Secrets location:**
- op1.fun email/token are stored in `data/settings.json`; this file should be treated as a secret-bearing local configuration file.

## Webhooks & Callbacks

**Incoming:**
- None detected.

**Outgoing:**
- HTTPS GET requests to `op1.fun` listing pages and its API/file URLs (`server.js`).
- Browser fetches localhost JSON endpoints under `/api/*`; these are internal application calls, not external callbacks (`app/index.html`, `server.js`).

---

*Integration audit: 2026-08-20*
