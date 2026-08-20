# Codebase Structure

**Analysis Date:** 2026-08-20

## Directory Layout

```text
opzgui/
├── server.js                         # local Node server and API
├── parser.js                         # .opz binary parser
├── aif.js                            # AIFF/AIFC parser and WAV conversion
├── app/index.html                    # single-page browser UI
├── data/                             # persistent JSON metadata/settings
├── opzdisk/                          # local OP-Z disk-mode fallback
│   ├── projects/                     # project01.opz ... project10.opz
│   ├── samplepacks/                  # 8 instrument columns × 10 slots
│   └── config/                       # device configuration files
├── library/                          # song bundles and instrument archives
│   ├── auto-backups/
│   └── instrument-trash/
├── bounces/                          # local audio recordings
├── Contents/                         # bundled macOS/Unity application payload
├── Start OP-Z Manager.command        # macOS launcher
├── README.md                         # usage and workflow documentation
└── .planning/codebase/               # generated architecture mapping
```

## Directory Purposes

**Root JavaScript:** `server.js`, `parser.js`, and `aif.js` are the complete application backend and format layer. Keep new server routes/helpers in `server.js`; put reusable binary-format logic in the relevant adapter.

**`app/`:** Contains the served frontend. `app/index.html` owns the complete UI, styles, DOM rendering, API calls, and WebAudio sketch playback.

**`data/`:** Runtime JSON state. `data/meta.json` stores song metadata keyed by content hash; `data/settings.json` stores integration settings. Do not add secrets to source-controlled documentation.

**`opzdisk/`:** Checked-in local fallback shaped like an OP-Z disk. Add project fixtures under `opzdisk/projects/` and instrument fixtures under the matching `opzdisk/samplepacks/<type>/<slot>/` directory.

**`library/`:** User-created persistent artifacts. Song bundles contain `song.opz` and `info.json`, with optional deep-backup `samplepacks/`; automatic restore backups go under `library/auto-backups/`.

**`bounces/`:** Local WAV/AIFF/other audio files discovered for recording links and playback.

**`Contents/`:** macOS application bundle resources and native libraries. Treat as packaged external/runtime content; application behavior belongs in root JS or `app/`.

## Key File Locations

**Entry Points:**
- `Start OP-Z Manager.command`: macOS double-click launcher.
- `server.js:551`: starts the HTTP server on port 8765.
- `app/index.html`: browser entry document served at `/`.

**Configuration:**
- `data/meta.json`: hash-keyed song annotations.
- `data/settings.json`: integration credentials/settings (existence and schema only; values are private).
- `opzdisk/config/`: OP-Z disk configuration fixtures.

**Core Logic:**
- `server.js:41-64`: source selection.
- `server.js:66-92`: project slot scanning.
- `server.js:147-183`: library scanning.
- `server.js:313-548`: HTTP API and static/audio serving.
- `parser.js`: `.opz` decoding.
- `aif.js`: sample-pack decoding.

**Testing:**
- No test directory or test files detected. Use small fixture checks against `parser.js`/`aif.js` if adding non-trivial format logic.

## Naming Conventions

**Files:** Root implementation files use lowercase names (`server.js`, `parser.js`, `aif.js`); data/project filenames follow device conventions (`project01.opz`); library bundles use timestamped names.

**Directories:** Lowercase functional directories (`app`, `data`, `library`, `bounces`, `opzdisk`). Sample-pack categories are numbered kebab-case names (`1-kick` through `8-chord`) and slots are zero-padded (`01`–`10`).

**JavaScript symbols:** Functions and variables use camelCase; constants use uppercase names (`PACK_TYPES`, `MIME`); API paths use lowercase slash-separated nouns/actions (`/api/clear-slot`, `/api/instruments/move`).

## Where to Add New Code

**New Feature:**
- Backend behavior/API: add the smallest helper and route section in `server.js`.
- Browser behavior: extend the corresponding inline section in `app/index.html` and call the existing `api()` helper.
- Persistent feature state: extend `data/meta.json` schema only when state cannot be derived from files.

**New Component/Module:**
- Format parsing or conversion: `parser.js` for `.opz`, `aif.js` for AIFF/sample metadata.
- A separate module is justified only for a new format or independently reusable boundary; there is no module directory convention.

**Utilities:**
- Shared server filesystem/request helpers: nearby helper section in `server.js` (`server.js:224-257`).
- Shared browser helpers: inline utility section in `app/index.html` (`app/index.html:265-281`).

## Special Directories

**`Contents/`:** macOS application bundle; generated/packaged runtime content, not the place for feature code.

**`opzdisk/`:** Local device-shaped working data; project and sample-pack files are mutable runtime fixtures.

**`library/`:** User-generated backups and recoverable trash; not generated build output.

**`.planning/codebase/`:** GSD analysis artifacts generated for planning; committed by the orchestrator, not application runtime.

---

*Structure analysis: 2026-08-20*
