<a id="readme-top"></a>

<div align="center">
  <a href="https://github.com/NakanoSanku/anki-studio">
    <img src="public/icon-maskable.svg" alt="Anki Studio logo" width="104" height="104">
  </a>

  <h1>Anki Studio</h1>

  <p>
    <strong>A browser-first workspace for creating, reviewing, studying, and syncing Anki-style flashcards.</strong>
  </p>

  <p>
    Build notes with templates and AI, approve them before study, schedule reviews with FSRS, and sync full projects through Google Sheets.
  </p>

  <p>
    <a href="#getting-started"><strong>Get Started →</strong></a>
    &nbsp;·&nbsp;
    <a href="docs/PROJECT_STRUCTURE.md">Documentation</a>
    &nbsp;·&nbsp;
    <a href="https://github.com/NakanoSanku/anki-studio/issues">Issues</a>
    &nbsp;·&nbsp;
    <a href="README.md"><strong>English</strong></a>
    &nbsp;·&nbsp;
    <a href="README.zh-CN.md">简体中文</a>
  </p>
</div>

<div align="center">

[![UI Checks][ui-checks-shield]][ui-checks-url]
[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stars][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]

</div>

<p align="center">
  <a href="#about">About</a> ·
  <a href="#built-with">Built With</a> ·
  <a href="#getting-started">Getting Started</a> ·
  <a href="#usage">Usage</a> ·
  <a href="#google-sheets-sync">Google Sheets Sync</a> ·
  <a href="#deployment">Deployment</a> ·
  <a href="#contributing">Contributing</a>
</p>

---

> [!NOTE]
> Anki Studio is **local-first**. Decks and study data live in IndexedDB first. Google Sheets sync is optional, and API keys plus generated audio cache remain device-local.

<a id="about"></a>
## ✨ About the Project

Anki Studio keeps authoring and studying in one browser-first workspace. It combines note templates, AI-assisted authoring, review approval, FSRS scheduling, import/export tools, and optional Google Sheets synchronization without making the spreadsheet the source of truth for scheduling data.

The key product boundary is **review before publish**: newly created notes, AI-generated notes, AI-filled notes, and externally edited Google Sheets notes remain pending until you approve them. Pending notes stay editable and syncable, but they do not enter Study, Voice Tutor, CSV export, or APKG export.

### Highlights

- ✅ **Approval-gated notes** — review generated or externally edited content before it becomes study material.
- 🧠 **FSRS scheduling** — daily new/review limits, retention controls, study history, and due queues powered by `ts-fsrs`.
- ✨ **AI authoring** — fill empty fields, batch-generate notes from source material, edit templates, and customize prompts through an OpenAI-compatible endpoint.
- 🎨 **Template Studio** — edit fields, front/back HTML, CSS, multiple card templates, and Anki `{{Field}}` syntax with live preview.
- 🔄 **Google Sheets sync** — OAuth-based multi-device sync with editable deck previews, revision tracking, conflict handling, and stable deck-to-sheet mapping.
- 🔊 **TTS-aware export** — bind generated audio fields to note fields, preview speech, and package audio when exporting APKG.
- 💾 **Local-first storage** — decks and study data live in IndexedDB, and the app can be installed as a PWA.
- 📦 **Import and export** — CSV, JSON, APKG, and COLPKG import paths, plus JSON active-deck backups and approved-only CSV/APKG exports.

<a id="built-with"></a>
## 🧰 Built With

[![Next.js][Next.js]][Next-url]
[![React][React.js]][React-url]
[![TypeScript][TypeScript]][TypeScript-url]
[![Tailwind CSS][TailwindCSS]][TailwindCSS-url]
[![Google Sheets][GoogleSheets]][GoogleSheets-url]
[![Docker][Docker]][Docker-url]

Supporting libraries and integrations include CodeMirror 6 for template/prompt editing, `ts-fsrs` for scheduling, `sql.js` + JSZip for APKG handling, NextAuth for Google OAuth, and the Google Sheets, Drive, and Picker APIs for synchronization and spreadsheet selection.

<a id="getting-started"></a>
## 🚀 Getting Started

### Prerequisites

- Node.js 22
- npm

Node.js 22 is also used by the repository's `UI checks` workflow.

### Installation

1. Clone the repository.

   ```bash
   git clone https://github.com/NakanoSanku/anki-studio.git
   cd anki-studio
   ```

2. Install dependencies.

   ```bash
   npm ci
   ```

3. Start the development server.

   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000`.

> [!TIP]
> Google Sheets sync is optional for local development. AI provider settings are configured inside **Settings → AI** and are stored on the device.

<details>
<summary><strong>Quality checks</strong></summary>
<br>

Run the same validation sequence used by CI:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

</details>

<a id="usage"></a>
## 💡 Usage

A typical Anki Studio workflow is:

1. Create or import a deck.
2. Configure note fields and card templates in Template Studio.
3. Create notes manually, fill missing fields with AI, or batch-generate notes from source material.
4. Review pending notes before publishing them to study.
5. Study approved cards using FSRS scheduling.
6. Optionally sync deck state through Google Sheets or export approved notes as CSV/APKG.

### Review lifecycle

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

### Data and export semantics

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

<a id="google-sheets-sync"></a>
## 🔄 Google Sheets Sync

Anki Studio uses Google OAuth and the Sheets API directly. One spreadsheet can contain multiple decks. Each deck has:

- a visible worksheet for human-readable note preview/editing;
- a hidden payload worksheet for the current full deck state and revision metadata; old payload revisions are compacted after a successful write;
- an entry in the hidden `_anki_studio_sync` index for stable mapping and tombstones.

The visible worksheet keeps a hidden first column containing stable note IDs. Do not rename its headers or manually modify/delete the hidden sync worksheets.

Changes made in a visible worksheet are materialized on the next sync. **New or changed rows become Pending review** before they can enter Study or published exports.

<details>
<summary><strong>Google Cloud setup</strong></summary>
<br>

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

<a id="deployment"></a>
## 🚢 Deployment

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

### Repository guide

- [`docs/PROJECT_STRUCTURE.md`](docs/PROJECT_STRUCTURE.md) — module layout and data flow
- [`docs/adr/`](docs/adr/) — architecture decision records
- [`CONTEXT.md`](CONTEXT.md) — domain terminology and project constraints
- [`.env.example`](.env.example) — supported server environment variables
- [`compose.example.yml`](compose.example.yml) — Docker Compose example

<a id="contributing"></a>
## 🤝 Contributing

When preparing a change:

1. Fork or branch from the repository.
2. Make the implementation and documentation updates together.
3. Run the validation suite:

   ```bash
   npm run lint
   npm run typecheck
   npm test
   npm run build
   ```

4. Open a pull request with the behavior change and verification notes.

Useful development scripts:

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

### Contributors

<a href="https://github.com/NakanoSanku/anki-studio/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=NakanoSanku/anki-studio" alt="Anki Studio contributors">
</a>

<a id="contact"></a>
## 📬 Contact

Project: [github.com/NakanoSanku/anki-studio](https://github.com/NakanoSanku/anki-studio)  
Issues: [github.com/NakanoSanku/anki-studio/issues](https://github.com/NakanoSanku/anki-studio/issues)

<div align="center">
  <br>
  <a href="#readme-top"><strong>↑ Back to top</strong></a>
</div>

<!-- MARKDOWN LINKS & IMAGES -->
[ui-checks-shield]: https://github.com/NakanoSanku/anki-studio/actions/workflows/ui-checks.yml/badge.svg
[ui-checks-url]: https://github.com/NakanoSanku/anki-studio/actions/workflows/ui-checks.yml
[contributors-shield]: https://img.shields.io/github/contributors/NakanoSanku/anki-studio?style=flat-square
[contributors-url]: https://github.com/NakanoSanku/anki-studio/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/NakanoSanku/anki-studio?style=flat-square
[forks-url]: https://github.com/NakanoSanku/anki-studio/network/members
[stars-shield]: https://img.shields.io/github/stars/NakanoSanku/anki-studio?style=flat-square
[stars-url]: https://github.com/NakanoSanku/anki-studio/stargazers
[issues-shield]: https://img.shields.io/github/issues/NakanoSanku/anki-studio?style=flat-square
[issues-url]: https://github.com/NakanoSanku/anki-studio/issues

[Next.js]: https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs&logoColor=white
[Next-url]: https://nextjs.org/
[React.js]: https://img.shields.io/badge/React-19-20232A?style=flat-square&logo=react&logoColor=61DAFB
[React-url]: https://react.dev/
[TypeScript]: https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white
[TypeScript-url]: https://www.typescriptlang.org/
[TailwindCSS]: https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white
[TailwindCSS-url]: https://tailwindcss.com/
[GoogleSheets]: https://img.shields.io/badge/Google_Sheets-Sync-34A853?style=flat-square&logo=googlesheets&logoColor=white
[GoogleSheets-url]: https://developers.google.com/workspace/sheets/api
[Docker]: https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white
[Docker-url]: https://docs.docker.com/
