# AGENTS.md

Single source of truth for coding standards, architecture, and commands in this repository. Consumed by Claude Code (via `CLAUDE.md` import) and by `gga` as its review ruleset (`RULES_FILE`).

## Commands

```bash
pnpm start:dev          # dev server with watch
pnpm build              # compile TypeScript via nest build
pnpm lint               # ESLint with auto-fix
pnpm test               # unit tests (jest)
pnpm test:watch         # unit tests in watch mode
pnpm test:cov           # coverage report
pnpm test:e2e           # end-to-end tests

pnpm db:migrate         # run Prisma migrations (prisma migrate dev)
pnpm db:seed            # seed default data (tsx prisma/seed.ts)
```

`pnpm test:e2e` boots the real `AppModule` (real Prisma, no mocks) against Postgres, so the `db` service from `docker-compose.yml` must be up on `localhost:5432` first (`docker compose up -d db`, then `npx prisma migrate deploy` and `pnpm db:seed` once). It never reads the project's own `.env` — `test/setup-env.ts` (wired via Jest's `setupFiles`) hardcodes the local docker-compose `DATABASE_URL` (plus a throwaway `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL`) unless the environment already sets them, specifically so e2e runs can never accidentally hit whatever remote database `.env` happens to point at. e2e specs use `@swc/jest` (not `ts-jest`, which the unit test config uses) with `transformIgnorePatterns: []` (transforms all of `node_modules`) because Prisma 7's generated client and Better-Auth's dependency tree (`better-call`, `@noble/hashes`, `jose`, etc.) ship real ESM — plain `tsc`-based transforms and any node_modules allowlist regex turn into permanent whack-a-mole as new transitive ESM deps show up. Every e2e spec must call `createAuthenticatedUser(app)` from `test/utils/test-app.ts` (signs up a throwaway user via the real `/auth/sign-up/email` route and returns a session cookie) and set that cookie on every request — the global `AuthGuard` rejects unauthenticated requests with 401.

After modifying `prisma/schema.prisma`, regenerate the client:
```bash
npx prisma generate
```

Run a single test file:
```bash
pnpm test --testPathPatterns=movement-type
```

### Docker (local)

`docker-compose.yml` is for local development only — it runs the app (hot-reload, `development` Dockerfile stage) plus a local Postgres container. It has no production equivalent.

```bash
docker compose up          # app on :3000 + Postgres on :5432
docker compose up --build  # rebuild the app image after dependency changes
docker compose down -v     # stop and wipe the local db volume
```

On a rootless Podman host (no `docker` CLI, `podman.socket` active instead) use the `docker-compose` binary against the podman socket:
```bash
export DOCKER_HOST="unix:///run/user/$(id -u)/podman/podman.sock"
docker-compose up -d
```

First time only, once containers are up, apply migrations and seed data:
```bash
docker compose exec app npx prisma migrate deploy
docker compose exec app pnpm db:seed
```

On Fedora/RHEL (SELinux enforcing), the bind mount uses the `:Z` flag so the container can read the source — don't drop it when editing the volume list.

### Deployment (Dokploy)

Production only containerizes the Node.js app — the `runtime` stage in `Dockerfile` (`docker build .` targets it by default, being the last stage). Dokploy provides Postgres as a separate managed service; the container never runs its own database. Point `DATABASE_URL` at the Dokploy-provisioned Postgres instance via environment variables in Dokploy — do not bake credentials into the image. The runtime image does not run migrations automatically; apply `npx prisma migrate deploy` against the target database before (re)deploying a version that changed `prisma/schema.prisma`.

## Architecture

Hexagonal architecture with one NestJS module per feature. Each module is fully self-contained. Feature modules are grouped under a business-domain folder (`src/modules/<domain>/<feature>/`), since this project hosts multiple business domains over time — not a single one.

Current domains:
- `money-manager` — `movement-type`, `account`, `category`, `movement`, `report` (the personal-finance ledger).

### Module structure

```
src/modules/<domain>/<feature>/
├── domain/
│   ├── entities/           ← pure TypeScript classes, no framework deps
│   └── ports/              ← repository interfaces + injection Symbol
├── application/
│   └── use-cases/          ← one file per use case, depend only on ports
├── infrastructure/
│   ├── controllers/        ← HTTP layer, calls use cases directly
│   ├── repositories/       ← Prisma implementations of domain ports
│   └── dto/                ← class-validator DTOs for request bodies
└── <feature>.module.ts
```

Cross-module imports (see "Cross-module dependencies" below) use the full path, e.g. `@modules/money-manager/movement-type/application/use-cases/get-movement-type-by-id.use-case`.

A feature with no persistence of its own (e.g. `report`, which only aggregates another feature's exported use case) skips `domain/` entirely — no entity or port to define — and keeps just `application/use-cases/` + `infrastructure/controllers/`. This is intentional, not a shortcut.

**Dependency rule (enforced):** `domain` → nothing. `application` → `domain` only. `infrastructure` → `application` + `domain`. Flag any import that violates this direction.

### Shared

- `src/shared/domain/base.entity.ts` — `BaseEntity` abstract class with `id`, `createdAt`, `updatedAt` getters/setters; all domain entities extend this
- `src/shared/exceptions/domain.exception.ts` — `DomainException` base + `NotFoundException`, `ValidationException`, `ConflictException`
- `src/shared/exceptions/http-exception.filter.ts` — maps domain exceptions to HTTP status codes; registered globally in `main.ts`
- `src/shared/interceptors/response.interceptor.ts` — wraps all successful responses as `{ statusCode, ...body }`; registered globally in `main.ts`
- `src/shared/decorators/current-user.decorator.ts` — `@CurrentUser()`, reads the authenticated user Better-Auth's `AuthGuard` attached to the request
- `src/shared/guards/auth.guard.ts` — `AuthGuard`, registered globally via `APP_GUARD` in `app.module.ts`

### Database

- **Prisma 7** with `@prisma/adapter-pg` (driver adapter required — not the legacy URL-only mode)
- Prisma client is generated to `src/config/database/generated/prisma/` (not `node_modules`)
- Import from `generated/prisma/client.js` (`.js` extension required by `moduleResolution: nodenext`)
- `PrismaModule` is `@Global()`, so `PrismaService` is available everywhere without importing `PrismaModule` per module
- `PrismaService` creates the adapter inside the constructor (not at module level) so `DATABASE_URL` is available from `dotenv`
- `prisma/seed.ts` seeds the 3 default `MovementType` records (`expense`, `income`, `transfer`); run with `tsx`

### Dependency injection for ports

Repository ports use a Symbol token, not the interface directly:

```ts
// port file exports both:
export interface MovementTypeRepositoryPort { ... }
export const MOVEMENT_TYPE_REPOSITORY = Symbol('MovementTypeRepositoryPort');

// use case imports the interface as `import type` (required by isolatedModules):
import { MOVEMENT_TYPE_REPOSITORY } from '...port';
import type { MovementTypeRepositoryPort } from '...port';

// module wires the implementation:
{ provide: MOVEMENT_TYPE_REPOSITORY, useClass: PrismaMovementTypeRepository }
```

### Entity pattern

All entities extend `BaseEntity`, which provides `id`, `createdAt`, `updatedAt`. Each entity defines only its domain-specific fields:

```ts
// base.entity.ts
export type BaseEntityProps = { id?: string; createdAt?: Date; updatedAt?: Date };
export abstract class BaseEntity { /* id, createdAt, updatedAt getters/setters */ }

// feature entity
export type MovementTypeProps = BaseEntityProps & { name: string; isDefault?: boolean };
export class MovementTypeEntity extends BaseEntity {
  constructor(props?: MovementTypeProps) {
    super(props); // handles id, createdAt, updatedAt
    // only domain-specific fields here
  }
}
```

Use cases define their own response type and map from the entity explicitly before returning to the controller.

### Response shape

All HTTP responses follow this envelope (applied by `ResponseInterceptor`):

```json
{ "statusCode": 200, "message": "...", "data": { ... } }
```

Controllers return `{ message, data }` and the interceptor injects `statusCode`.

Each use case defines its own response type (e.g. `CreateMovementTypeResponse`) instead of reusing the entity plain type, so the response shape is explicit and decoupled from the domain.

**Create/Update/Delete return `{ id: string }` only** — never the full entity fields, even if the repository call returns more. `GetAll`/`GetById` use cases are unaffected and still return full mapped field sets.

### Domain enums and constants

Allowed-values lists (e.g. `ACCOUNT_TYPES`) live in `domain/enums/<name>.enum.ts`, never inline inside a use-case or a DTO. If both a DTO (`class-validator`'s `@IsIn`) and a use case need the same list, both import it from that single file — never duplicate the literal array.

### Business-rule validation must be symmetric

A rule enforced in `Create` (allowed value, referenced-id existence, etc.) must be enforced identically in `Update` whenever that field is being changed — do not rely solely on the DTO's `class-validator` decorators, since a use case can be invoked directly (from another module, a script, a future non-HTTP entrypoint) bypassing the DTO. The DTO is the first line of defense at the HTTP boundary; the use case is the one that actually holds the invariant.

### Delete semantics

Delete is always a real, physical row removal (`repository.delete(entity): Promise<void>`) — never a soft-delete-via-flag. If the entity has an `isActive`-style boolean, it exists purely as a manual toggle exposed through `Update`, unrelated to `Delete`.

Before deleting, the use case must check every place elsewhere in the schema that references this entity (every FK pointing at it) and throw a `ValidationException` if any reference count is > 0 — never let the DB's `onDelete: Restrict` constraint surface as a raw Prisma error. If nothing in the schema references the entity, no guard is needed.

### Cross-module dependencies

A module exports **only use cases** in its `exports` array — never a repository Symbol token. When one feature needs to read/validate data owned by another feature (e.g. `Category` validating `movementTypeId`, `Movement` validating `accountId`/`categoryId`/`movementTypeId`), the consuming module imports the owning feature's `Module` and injects one of its exported use cases via normal Nest DI (no `@Inject` needed for a concrete class token). The owning module adds a `GetXById`-style use case (throws `NotFoundException` when missing, returns mapped fields) purely to serve this purpose if one doesn't already exist.

### Authentication and data ownership

Auth is [Better-Auth](https://better-auth.com) (self-hosted, not a third-party service — runs inside this process against the same Postgres via the Prisma adapter). `src/config/auth/auth.provider.ts` builds the `betterAuth()` instance as a Nest factory provider injecting the existing `PrismaService`; `src/main.ts` mounts its raw handler directly on the underlying Express adapter at `/auth/*splat` (before Nest's body parser, since Better-Auth needs the unparsed request). A global `AuthGuard` (`src/shared/guards/auth.guard.ts`, registered via `APP_GUARD`) protects every Nest-routed endpoint by default — routes mounted directly on the Express adapter (Better-Auth's own routes, Swagger's `/docs`) bypass Nest's router entirely and are never touched by it.

This project is API-only (no server-rendered frontend of its own), so every client lives on a different origin. `CORS_ORIGINS` (comma-separated) drives two independent things that must stay in sync: `app.enableCors({ origin, credentials: true })` in `src/main.ts` (registered *before* the raw `/auth/*splat` mount — Express runs middleware/routes in registration order, and the auth handler responds without calling `next()`, so anything registered after it never sees `/auth/*` requests) and Better-Auth's own `trustedOrigins` in `auth.provider.ts` (required for it to accept a cross-site session cookie). For non-browser clients (mobile apps, other services) that can't hold a cookie, Better-Auth's `bearer()` plugin (`better-auth/plugins`) is enabled — sign-in/sign-up responses carry a `set-auth-token` header, which the client resends as `Authorization: Bearer <token>` on subsequent requests; `AuthGuard` needs no changes since it already forwards all request headers into `auth.api.getSession()`.

`Account`, `Category`, and `Movement` are owned by a `User` (`userId` FK, `onDelete: Cascade`). `MovementType` stays global/shared (seeded defaults + user-created custom types are all visible to everyone) — it is a shared taxonomy, not personal data, so it does **not** get a `userId` column.

For every ownership-scoped entity: `GetAllUseCase.execute(userId)`, `GetByIdUseCase.execute(id, userId)`, and the repository's `findById`/`findAllWithBalance`-style methods filter by `WHERE id = ? AND userId = ?` (via `findFirst`, not `findUnique`, since `id` alone is no longer sufficient to scope the row) — a lookup for another user's row returns `null` → `NotFoundException`, the same as a truly missing id. Never leak existence via a 403; a wrong-owner id and a nonexistent id must be indistinguishable to the caller. `Create`/`Update`/`Delete` commands carry `userId` as a required constructor param, sourced from `@CurrentUser()` (`src/shared/decorators/current-user.decorator.ts`) in the controller — never trust a `userId` from the request body/DTO.

Cross-module ownership checks matter just as much as same-module ones: `Movement`'s use cases call `GetAccountByIdUseCase.execute(accountId, userId)` and `GetCategoryByIdUseCase.execute(categoryId, userId)` (and `toAccountId` too, for transfers) so a user can't reference another user's account/category in their own movement. `GetMovementTypeByIdUseCase.execute(movementTypeId)` stays unscoped since that entity is global.

### Monetary amounts

Money is stored in Postgres as `Decimal`, but the domain/DTO layer only ever sees an integer number of cents (e.g. `amountCents`) — never a float. Only the Prisma repository, at the infra boundary, converts to/from `Decimal` (`toFixed(2)` string in, `Number(amount.toFixed(2).replace('.', ''))` out), mirroring the pattern in each repository's own private helper methods. This conversion is intentionally duplicated per-repository rather than extracted into a shared utility (kept local, same as each repository's own `toEntity` mapper).

### Key TypeScript constraints

- `isolatedModules: true` — interfaces used in decorated constructor params must be `import type`
- `moduleResolution: nodenext` — all imports of local `.ts` files need the `.js` extension when targeting generated or non-src paths
- `tsconfig.build.json` excludes `prisma/` and `generated/` from the NestJS build
- `ts-node` is incompatible with `module: nodenext` — use `tsx` for scripts outside the NestJS build (seed, etc.)

## Review priorities (for automated review)

1. Dependency-rule violations (domain importing from application/infrastructure, or application importing infrastructure).
2. Missing `import type` on interface-only imports in decorated classes.
3. Use cases returning entities directly instead of a mapped response type.
4. Controllers bypassing the use-case layer to touch repositories/Prisma directly.
5. New repository ports missing a Symbol token.
6. Missing `.js` extensions on local imports outside `src/` under `moduleResolution: nodenext`.
7. Prisma client imported from `@prisma/client` instead of the generated path.
8. A module exporting a repository Symbol token instead of a use case.
9. `Create`/`Update`/`Delete` use cases returning more than `{ id: string }`.
10. A validation rule present in `Create` but missing from `Update` for the same field.
11. `Delete` implemented as a soft-delete flag flip instead of a real `repository.delete()`, or missing a referential guard for entities that ARE referenced elsewhere in the schema.
12. Enum-like literal arrays duplicated across files instead of living in a single `domain/enums/*.ts`.
13. An ownership-scoped entity's use case/repository method missing a `userId` filter, trusting a `userId` from the request body instead of `@CurrentUser()`, or returning 403 instead of 404 for another user's row.
