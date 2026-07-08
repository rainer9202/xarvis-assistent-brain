# Xarvis Brain

A personal finance ledger API — accounts, categories, movements (including transfers), and a consolidated balance report. Multi-user, self-hosted authentication (no third-party auth provider). Built with NestJS, Prisma, and Postgres, following hexagonal architecture.

For coding standards, architecture conventions, and the full command reference, see [AGENTS.md](./AGENTS.md) — it's the single source of truth for this repo and is consumed directly by AI coding agents and the `gga` pre-commit review.

## Quickstart (Docker)

```bash
docker compose up          # app on :3000, Postgres on :5432
docker compose exec app npx prisma migrate deploy
docker compose exec app pnpm db:seed
```

On a rootless Podman host, see the Docker section in [AGENTS.md](./AGENTS.md#docker-local) for the socket setup.

API docs (Swagger) are served at `http://localhost:3000/docs`.

## Authentication

Auth is [Better-Auth](https://better-auth.com), running self-hosted inside this app against the same Postgres — not a third-party service. Every endpoint except `/auth/*` and `/docs` requires a session.

```bash
curl -c cookies.txt -X POST http://localhost:3000/auth/sign-up/email \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"...","name":"Your Name"}'

curl -b cookies.txt http://localhost:3000/accounts
```

Each user only sees their own accounts, categories, and movements. `movement-type` (expense/income/transfer) is a shared, global taxonomy — not per-user.

## Local development (without Docker)

```bash
pnpm install
pnpm start:dev
```

Requires a local Postgres reachable via `DATABASE_URL` in `.env` — see `docker-compose.yml` for the expected local credentials.

## Commands

```bash
pnpm test               # unit tests
pnpm test:e2e           # e2e tests (needs the db service up — see AGENTS.md)
pnpm lint               # ESLint with auto-fix
pnpm build               # production build
```

## Deployment

Production (Dokploy) builds only the `runtime` stage of the `Dockerfile` and points at a Dokploy-managed Postgres instance — see the Deployment section in [AGENTS.md](./AGENTS.md#deployment-dokploy).
