---
name: verify
description: Build/launch/drive recipe for verifying xarvis-assistent-brain (NestJS ledger API) end-to-end via HTTP.
---

# Verify: xarvis-assistent-brain

Surface is HTTP (NestJS API on :3000). Needs Postgres — always start via docker-compose, never `npx nest start` bare.

## Launch (podman host, no `docker` CLI)

```bash
export DOCKER_HOST="unix:///run/user/$(id -u)/podman/podman.sock"
docker-compose up -d --build   # app :3000, db :5432
docker-compose logs app --tail=60   # confirm clean boot, check mapped routes
```

First boot on a fresh volume needs schema + seed data (no migrations yet, uses `db push`):

```bash
docker-compose exec -T app npx prisma db push
docker-compose exec -T app pnpm db:seed   # creates expense/income/transfer MovementTypes
```

Teardown when done: `docker-compose down -v` (wipes the db volume — fine, it's local-dev only).

## Drive it

All modules live under `src/modules/money-manager/{account,category,movement-type,movement}`. Routes: `/accounts`, `/categories`, `/movement-types`, `/movements`. `movement-type` intentionally has **no** `GET /:id` HTTP route (its `GetByIdUseCase` is exported for cross-module DI validation only, not exposed over HTTP) — that's by design, not a bug.

Golden path:
1. `GET /movement-types` → grab seeded `expense`/`income`/`transfer` ids.
2. `POST /accounts` (name, type — type is one of `cash|bank|card`; `balanceCents` is NOT a create field, balance is derived live from movements, always starts at 0).
3. `POST /categories` (name, movementTypeId — required FK).
4. `POST /movements` with `accountId`, `categoryId`, `movementTypeId`, `amountCents`, `date`.
5. `GET /accounts/:id` → `balanceCents` reflects the movement (computed, not stored).
6. Transfer: `POST /movements` with `movementTypeId=transfer` + `toAccountId` — both accounts' balances update from one row.

Delete-guard checks worth re-running after any change to `account`/`category`/`movement`:
- Deleting an account/category/movement-type still referenced by a movement → `400 ValidationException`, never a raw Prisma FK error.
- Default seeded movement types (`expense`/`income`/`transfer`) are permanently undeletable regardless of references.

## Gotchas found during verification (2026-07-07)

- `class-validator`'s global `ValidationPipe({ whitelist: true })` silently **strips** unknown DTO fields rather than rejecting the request — passing `balanceCents` to `POST /accounts` returns 201 with no error, field just gets dropped.
- Transfer validation is symmetric and solid: rejects transfer without `toAccountId`, rejects `toAccountId` on non-transfer movements, rejects self-transfer (`toAccountId === accountId`).
