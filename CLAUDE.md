# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

AA Mühendislik Liderliği Kaynak Yönetimi Sistemi — resource/capacity planning app (projects, teams, planned vs. actual allocations, risks, scenarios). Docs, UI text, and user communication are in Turkish.

## Commands

Requires Node.js ≥ 24 (backend imports `shared/*.ts` directly via Node's type stripping — no backend build step).

- First-time setup / start: `bash baslat-mac.sh` (Windows: `baslat-windows.cmd`) — creates the admin account, installs packages, builds the UI.
- Start server: `npm start` (reads `.env`; default `http://127.0.0.1:3000`). It refuses to start if the built `site/` doesn't match sources (`deployment-manifest.json`) — run `npm run build` after frontend/shared changes.
- Build: `npm run build` (frontend typecheck + Vite build into `site/`, rewrites `deployment-manifest.json`).
- Unit/integration tests: `npm test` (`node --test tests/*.test.mjs`, preceded by `check:domain`).
- Single test file: `node --test tests/<name>.test.mjs`; single test: add `--test-name-pattern "<pattern>"`.
- Full pre-commit check (same as CI): `npm run verify` (prettier check + tests + build), plus `npm run deploy:verify`.
- Format: `npm run format` (prettier lives in `frontend/`; it covers `shared/`, `backend/`, `scripts/`, `tests/` too).
- Browser tests: `npm run test:ui` (Playwright, isolated synthetic data; builds first).
- MSSQL tests: `npm run test:db` (needs `.env.mssql.test`, see `MSSQL-TEST-KILAVUZU.md`).
- DB: `npm run db:migrate`, `npm run db:check`, `npm run db:backup` / `db:verify-backup`.
- Install: `npm ci` at root and `npm --prefix frontend ci` (two separate package trees).

## Architecture

- **`shared/`** — pure domain logic in TypeScript, imported by both the backend (`.mjs`, run as-is by Node) and the frontend. `scripts/check-domain.mjs` enforces via AST that `shared/` has no forbidden dependencies (no Node/backend/frontend imports); a violation blocks `npm test`. `shared/server-domain.ts` is the backend's validation entry point; `snapshot-*-validation.ts` validate the full planning snapshot.
- **`backend/`** — Express 5 app (`server.mjs` → `app.mjs`). Persistence is behind `store.mjs` with two adapters in `backend/adapters/`: `sqljs` (local SQLite file `data/planlama.sqlite`) and `mssql` (production). Selected by `DB_PROVIDER` in `.env`.
  - Writes are command-based (`*-commands.mjs`) and run inside a Store transaction that handles permission, revision (optimistic concurrency), audit, and generation. `planning-reader.mjs` / `planning-writer.mjs` / `identity-repository.mjs` use the given connection and must not commit on their own.
  - New mutation endpoints must be wrapped with `admission.handler(...)` (`mutation-admission.mjs`, per-instance write queue → 503 + `Retry-After`). Report reads (`actual-view`, `activity-report`) use `report-read-admission.mjs` and lightweight read models instead of the full snapshot.
  - Optional Active Directory/LDAP login (`active-directory.mjs`, `directory-*.mjs`), see `ACTIVE-DIRECTORY-LDAP.md`.
- **Migrations** — `backend/migrations/NNN_sqljs.sql` + `NNN_mssql.sql` pairs registered in `migration-catalog.mjs` (with source fingerprints), applied by `schema-migrations.mjs`. Adding a version requires the catalog entry and both SQL files together; mismatches fail startup and backup tools. Read `backend/MIGRATIONS.md` before touching schema.
- **`frontend/`** — React 19 + Vite + Tailwind/Radix (shadcn-style components in `frontend/components`), built by `frontend/build.mjs` into `site/`, served statically by the backend. Entry: `frontend/src/App.tsx`.
- **`tests/`** — `node:test` files; most spin up a sql.js Store with synthetic data. `scripts/` holds maintenance, packaging, and CI helpers.

The many dated `*.md` files at the repo root (MIMARI-*, N3-*, M*-…) are design/verification records for past changes; consult the relevant one when modifying that area.
