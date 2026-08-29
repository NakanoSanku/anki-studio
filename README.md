<p align="center">
  <img src="./public/icon-maskable.svg" width="96" alt="Anki Studio app icon" />
</p>

<h1 align="center">Anki Studio</h1>

<p align="center">
  A browser-first workspace for creating, reviewing, studying, and syncing Anki-style flashcards.
</p>

<p align="center">
  Build notes with templates and AI, approve them before they enter study, schedule reviews with FSRS, and sync the full project through Google Sheets.
</p>

<p align="center">
  <a href="https://github.com/NakanoSanku/anki-studio/actions/workflows/ui-checks.yml"><img alt="UI checks" src="https://github.com/NakanoSanku/anki-studio/actions/workflows/ui-checks.yml/badge.svg" /></a>
  <img alt="Node.js 22" src="https://img.shields.io/badge/Node.js-22-339933?style=flat-square&logo=nodedotjs&logoColor=white" />
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs&logoColor=white" />
</p>

<p align="center">
  <a href="#getting-started">Getting started</a> ·
  <a href="#google-sheets-sync">Google Sheets sync</a> ·
  <a href="./docs/PROJECT_STRUCTURE.md">Project structure</a> ·
  <a href="./docs/adr/">ADRs</a>
</p>

## Why Anki Studio

Anki Studio keeps authoring and studying in one local-first web app. Notes live on the device first, while optional Google Sheets sync keeps multiple devices aligned without making the spreadsheet the source of truth for scheduling data.

The important boundary is **review before publish**: newly created notes, AI-generated notes, AI-filled notes, and externally edited Google Sheets notes stay pending until you approve them. Pending notes remain editable and syncable, but they do not enter Study, Voice Tutor, CSV export, or APKG export.

## Highlights

- **Approval-gated notes** — review generated or edited content before it becomes study material.
- **FSRS scheduling** — daily new/review limits, retention controls, study history, and due queues powered by `ts-fsrs`.
- **AI authoring** — fill empty fields, batch-generate notes from source material, edit templates, and customize prompts through an OpenAI-compatible endpoint.
- **Template Studio** — edit fields, front/back HTML, CSS, multiple card templates, and Anki `{{Field}}` syntax with live preview.
- **Google Sheets sync** — OAuth-based multi-device sync with editable deck previews, revision tracking, conflict handling, and stable deck-to-sheet mapping.
- **TTS-aware export** — bind generated audio fields to note fields, preview speech, and package audio when exporting APKG.
- **Local-first storage** — decks and study data are stored in IndexedDB; the app also ships as an installable PWA.
- **Import and export** — CSV, JSON, APKG, and COLPKG import paths, plus JSON active-deck backups and approved-only CSV/APKG exports.

## Review lifecycle

```text
Create / AI generate / AI fill / Sheets edit
                  │
                  ▼
             Pending review
                  │
             Review / approve
                  │
                  ▼
                Approved
          ┌───────┼────────┐
          ▼       ▼        ▼
        Study  Voice Tutor Export
```

Editing an approved note sends it back to **Pending review**. Existing decks created before review metadata was introduced are migrated as approved so upgrades do not hide previously usable notes.

## Data and export semantics

| Surface | Pending notes | Approved notes | Study history / templates |
| --- | --- | --- | --- |
| Local IndexedDB | Kept | Kept | Kept |
| Google Sheets sync payload | Synced | Synced | Synced |
| Editable Google Sheets preview | Visible/editable | Visible/editable | Not stored in the visible preview |
| JSON active-deck backup | Included | Included | Included for the active deck |
| CSV export | Excluded | Included | Not applicable |
| APKG export | Excluded | Included | Exported as Anki deck data |
| Study / Voice Tutor | Excluded | Included | Uses FSRS state |

API keys and generated audio cache are device-local and are not uploaded with deck sync.

## Tech stack

- Next.js 16 and React 19
- TypeScript 5
- Tailwind CSS 4 and Radix/shadcn UI primitives
- CodeMirror 6 for template and prompt editing
- `ts-fsrs` for scheduling
- `sql.js` + JSZip for APKG handling
- NextAuth for Google OAuth
- Google Sheets, Drive, and Picker APIs for sync selection and storage
- Vitest, ESLint, and TypeScript checks in CI

## Getting started

### Requirements

- Node.js 22
- npm

### Run locally

```bash
git clone https://github.com/NakanoSanku/anki-studio.git
cd anki-studio
npm ci
npm run dev
```

Open `http://localhost:3000`.

Google sync is optional for local development. AI provider settings are configured inside **Settings → AI** and are stored on the device.

### Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The `UI checks` workflow runs the same validation sequence for pull requests and `main`.

## Google Sheets sync

Anki Studio uses Google OAuth and the Sheets API directly. One spreadsheet can contain multiple decks. Each deck has:

- a visible worksheet for human-readable note preview/editing;
- a hidden payload worksheet for the current full deck state and revision metadata; old payload revisions are compacted after a successful write;
- an entry in the hidden `_anki_studio_sync` index for stable mapping and tombstones.

The visible worksheet keeps a hidden first column containing stable note IDs. Do not rename its headers or manually modify/delete the hidden sync worksheets.

Changes made in a visible worksheet are materialized on the next sync. **New or changed rows become Pending review** before they can enter Study or published exports.

<details>
<summary><strong>Google Cloud setup</strong></summary>

### 1. Enable APIs

Enable these APIs in one Google Cloud project:

- [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com)
- [Google Sheets API](https://console.cloud.google.com/apis/library/sheets.googleapis.com)
- [Google Picker API](https://console.cloud.google.com/apis/library/picker.googleapis.com)

Create a browser API key for Picker. Restrict it to your development/production origins and to the Google Picker API.

### 2. Create OAuth credentials

Create a **Web application** OAuth client in [Google Auth Platform](https://console.cloud.google.com/auth/overview).

For local development, add:

```text
Authorized JavaScript origin:
http://localhost:3000

Authorized redirect URI:
http://localhost:3000/api/auth/callback/google
```

Add the equivalent production origin and callback for your deployed domain.

### 3. Configure environment variables

Copy the checked-in example:

```bash
cp .env.example .env.local
```

Set the values defined in `.env.example`:

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_ALLOWED_EMAILS` | Optional comma-separated sign-in allowlist |
| `GOOGLE_PICKER_API_KEY` | Browser key restricted to Google Picker API |
| `GOOGLE_CLOUD_PROJECT_NUMBER` | Numeric Google Cloud project number used by Picker |
| `AUTH_SECRET` | NextAuth session secret |
| `NEXTAUTH_URL` | Public app URL; defaults to `http://localhost:3000` in the example |

Generate `AUTH_SECRET` with:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

### 4. Connect a spreadsheet

In **Settings → Sync**:

1. Connect the Google account.
2. Choose an existing spreadsheet with Google Picker, or paste an authorized spreadsheet edit URL.
3. Select the same spreadsheet on another device to share the synced library.

</details>

## Deployment

Anki Studio is a standard Next.js application and can run on Vercel, a Node.js host, or Docker. Production deployments that use Google sync must configure the same environment variables listed above and register the production origin/callback in Google Cloud.

### Docker image

`main` publishes a multi-architecture image to:

```text
ghcr.io/nakanosanku/anki-studio:latest
```

A Compose example is included:

```bash
cp compose.example.yml compose.yml
cp .env.example .env
# Fill in .env, then:
docker compose up -d
```

You can also build locally:

```bash
docker build -t anki-studio .
docker run --env-file .env.local -p 3000:3000 anki-studio
```

## Repository guide

- [`docs/PROJECT_STRUCTURE.md`](./docs/PROJECT_STRUCTURE.md) — module layout and data flow
- [`docs/adr/`](./docs/adr/) — architecture decision records
- [`CONTEXT.md`](./CONTEXT.md) — domain terminology and project constraints
- [`.env.example`](./.env.example) — supported server environment variables
- [`compose.example.yml`](./compose.example.yml) — Docker Compose example

## Development notes

Useful npm scripts:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server on port 3000 |
| `npm run build` | Create a production build |
| `npm run start` | Start the production server on port 3000 |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Typecheck the app and tests |
| `npm test` | Run the full Vitest suite |
| `npm run test:unit` | Run unit tests |
| `npm run test:contracts` | Run contract tests |
| `npm run test:watch` | Run Vitest in watch mode |
