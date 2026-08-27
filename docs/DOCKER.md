# Docker image / GHCR / Dokploy

Anki Studio supports a production Docker image based on Next.js `standalone` output. The runtime image listens on `0.0.0.0:3000`, runs as a non-root user, and includes a container health check.

## Build locally

```bash
cp .env.example .env
docker build -t anki-studio:local .
docker run --rm --env-file .env -p 3000:3000 anki-studio:local
```

Open `http://localhost:3000`.

You can also use the example Compose file:

```bash
cp .env.example .env
docker compose -f compose.example.yml up -d
```

## Published images

GitHub Actions publishes multi-architecture images (`linux/amd64` and `linux/arm64`) to:

```text
ghcr.io/nakanosanku/anki-studio
```

Tags:

- `latest`: the latest successful image from `main`.
- `edge`: the latest successful image from an `ui/**` development branch.
- branch tag: for example `ui-mobile-image2-redesign`.
- `sha-<commit>`: immutable commit image.

The current redesign branch can therefore be deployed with:

```text
ghcr.io/nakanosanku/anki-studio:edge
```

After the work is merged to `main`, production should normally use:

```text
ghcr.io/nakanosanku/anki-studio:latest
```

The first GHCR package may be private depending on repository/package settings. Either make the container package public in GitHub Packages or configure GHCR credentials in the deployment platform.

## Runtime environment

Configure these at runtime; do not bake secrets into the image:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
AUTH_SECRET=
GOOGLE_ALLOWED_EMAILS=
GOOGLE_PICKER_API_KEY=
GOOGLE_CLOUD_PROJECT_NUMBER=
NEXTAUTH_URL=https://anki.example.com
```

`NEXTAUTH_URL` must match the production origin configured in Google OAuth. The Google redirect URI is:

```text
https://anki.example.com/api/auth/callback/google
```

## Dokploy

Using a prebuilt image avoids the source checkout / Railpack / Nixpacks build path entirely.

Create an Application in Dokploy and configure it to deploy a Docker/registry image:

```text
Image: ghcr.io/nakanosanku/anki-studio
Tag while this PR is in development: edge
Tag after merge to main: latest
Container port: 3000
```

Add the runtime environment variables from the section above in Dokploy, then create the domain and route it to container port `3000`.

No database or persistent volume is required for the Next.js container. Deck data is primarily stored in browser IndexedDB and optional cloud synchronization is stored in Google Sheets/Drive.

If GHCR is private, configure a registry credential in Dokploy with a GitHub username and a token that has `read:packages`, or change the package visibility to Public.

## Health check

The image contains:

```text
GET http://127.0.0.1:3000/
```

as its Docker `HEALTHCHECK`. A healthy container should report `healthy` after startup.
