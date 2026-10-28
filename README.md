# OM Digital — Fleet Unavailability Dashboard

A web dashboard that reads operational data from MySQL through a small Express API and presents it in a React interface.


## Components

- **Frontend:** React, TypeScript, and Vite.
- **API:** Express and TypeScript.
- **Data:** MySQL through `mysql2`.
- **Runtime:** Dockerfile and environment-based configuration.

## Data flow

```mermaid
flowchart LR
  UI[React dashboard] --> API[Express API]
  API --> Cache[In-memory TTL cache]
  API --> DB[(MySQL)]
```

## Local development

Requires Node.js 20 or later and access to a compatible MySQL database. Copy `.env.example` to `.env`, set the database variables using authorized local values, then run `npm ci` and `npm run dev`. The client and API run as separate processes.

For a container build, use `docker build -t workshop-dashboard .` and provide the required environment variables at runtime. The server listens on `PORT` (default `3001`).

## Configuration

The example file documents the `VITE_*`, `PORT`, cache timing, and `DB_*` settings. It contains placeholders only. Keep the database service account read-only where possible and never commit `.env`.

## Repository note

Generated `node_modules/` and `dist/` content was tracked in the original repository. The source of truth is the application source and lockfile; generated dependencies and build output are excluded from the curated version.


## Snapshot review

This is a dashboard for vehicles undergoing maintenance or awaiting release. It reads MySQL through an Express service and caches responses. It is separate from the excluded maintenance control-tower project; no control-tower functions are claimed here.

Git-triggered Vercel deployment is disabled in the included web configurations. This update publishes source and documentation only.

## License

No new distribution license is granted for this corporate source edition. Public visibility does not grant reuse rights; obtain permission from the relevant rights holder. Existing third-party notices remain applicable.

## Verification record

See [snapshot checks and remaining limitations](docs/VERIFICATION.md).
