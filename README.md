# Photobox
Users scan a QR code at a physical kiosk, link to webapp, from webapp, select photos from their phone gallery, arrange them into a layout using a drag-and-drop tool, and receive a printed A4 page within seconds. The service supports single photos, collages, photo strips, and ID or mini-size prints. No app download or waiting in line is required.

Web-to-print photo collage app with:
- `Cloudflare Pages` for frontend
- `Cloudflare Workers` for backend API
- `Cloudflare D1` for database
- `Cloudflare R2` for file storage

This repo is intentionally kept simple:
- frontend Vue app stays in the repo root
- backend Worker lives in [`worker/`](/Users/ng/projects/photobox/worker)
- shared request/response types live in [`shared/`](/Users/ng/projects/photobox/shared)

## Project Structure
- [`src/`](/Users/ng/projects/photobox/src): Vue frontend
- [`worker/src/`](/Users/ng/projects/photobox/worker/src): Hono API running on Cloudflare Workers
- [`worker/migrations/`](/Users/ng/projects/photobox/worker/migrations): D1 SQL migrations
- [`shared/contracts.ts`](/Users/ng/projects/photobox/shared/contracts.ts): shared API contracts

## Local Setup
Requirements:
- Node.js 20+
- `pnpm`
- Cloudflare account only when you want to deploy

Install dependencies:

```bash
pnpm install
```

Start frontend:

```bash
pnpm dev:web
```

Start Worker API locally:

```bash
pnpm dev:api
```

Run type checks:

```bash
pnpm typecheck
```

Build frontend:

```bash
pnpm build:web
```

## Frontend Routes
- `/`: local landing page
- `/:stationSlug`: customer station page, for example `/tram1`
- `/dashboard`: placeholder for operator/admin dashboard

The customer route is a single frontend app. `tram1`, `tram2`, `tram3` are only URL params. The app reads the slug from the URL and resolves the station from the API.

## Worker API
Current scaffold:
- `GET /health`
- `GET /api/public/stations/:slug`
- `GET /api/operator/print-jobs`
- `GET /api/admin/stations`

Upload signing and print job creation are scaffolded but not fully implemented yet.

## D1 Migrations
Apply migrations locally:

```bash
pnpm db:migrate:local
```

Apply migrations to remote Cloudflare D1:

```bash
pnpm db:migrate:remote
```

Current initial migration:
- creates `stations`
- creates `users`
- creates `station_users`
- creates `assets`
- creates `print_jobs`
- creates `invoices`
- seeds `tram1`, `tram2`, `tram3`

## Manual Cloudflare Deploy
This section is written for manual deployment later. You do not need CI/CD to use it.

### 1. Login Wrangler
```bash
pnpm exec wrangler login
```

### 2. Deploy Frontend to Cloudflare Pages
Simplest manual way:

```bash
pnpm deploy:web
```

What it does:
- builds the Vue app into `dist`
- uploads `dist` to Cloudflare Pages

If Wrangler asks for a Pages project:
- use the Pages project named `photobox`
- reuse that same project on later deploys

Important:
- this is only for the frontend static site
- do not use the Worker config file for this step

### 3. Deploy Backend API to Cloudflare Workers
Manual deploy:

```bash
pnpm deploy:api
```

What it does:
- deploys the Worker defined in [`worker/wrangler.jsonc`](/Users/ng/projects/photobox/worker/wrangler.jsonc)

Important:
- this is separate from Pages
- frontend and backend are deployed as two different Cloudflare services

## Cloudflare Resources You Need Before Real Deployment
Before production-like deployment, create these in Cloudflare:

### Pages
- `photobox`

### Workers
- 1 Worker for the API

### D1
- `photobox`

### R2
- `photobox`

After creating them, update [`worker/wrangler.jsonc`](/Users/ng/projects/photobox/worker/wrangler.jsonc):
- replace `database_id`
- replace `bucket_name`
- optionally update `name`
- optionally update `APP_URL`

## Notes About Deploy Strategy
This repo contains both frontend and backend, but they should be deployed separately:
- Pages for the Vue frontend
- Workers for the Hono API

That separation is important because Cloudflare auto-detection can get confused by a mixed repo containing both `Vite` and `Hono`.

## Recommended Manual Deploy Order
When you are ready:

1. `pnpm install`
2. `pnpm typecheck`
3. `pnpm build:web`
4. create D1 and R2 in Cloudflare
5. update [`worker/wrangler.jsonc`](/Users/ng/projects/photobox/worker/wrangler.jsonc)
6. `pnpm db:migrate:remote`
7. `pnpm deploy:api`
8. `pnpm deploy:web`

## Current Status
Working now:
- Vue frontend with station route `/:stationSlug`
- Hono Worker scaffold
- D1 migration scaffold
- shared types

Not finished yet:
- real auth
- real R2 signed upload flow
- real print job creation flow
- operator dashboard
- admin dashboard


git switch main
git pull origin main

git switch -c feature-a
git add .
git commit -m "add feature"

git switch main
git merge feature-a