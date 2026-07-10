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

`pnpm test:e2e` boots the real `AppModule` (real Prisma, no mocks) against Postgres, so the `db` service from `docker-compose.yml` must be up on `localhost:5432` first (`docker compose up -d db`, then `npx prisma migrate deploy` and `pnpm db:seed` once). It never reads the project's own `.env` — `test/setup-env.ts` (wired via Jest's `setupFiles`) hardcodes the local docker-compose `DATABASE_URL` (plus a throwaway `JWT_SECRET`/`JWT_EXPIRES_IN`) unless the environment already sets them, specifically so e2e runs can never accidentally hit whatever remote database `.env` happens to point at. e2e specs use `@swc/jest` (not `ts-jest`, which the unit test config uses) with `transformIgnorePatterns: []` (transforms all of `node_modules`) because Prisma 7's generated client ships real ESM — plain `tsc`-based transforms and any node_modules allowlist regex turn into permanent whack-a-mole as new transitive ESM deps show up. Every e2e spec must call `createAuthenticatedUser(app)` from `test/utils/test-app.ts` (signs up a throwaway user via the real `POST /auth/sign-up` route and returns a Bearer access token) and send it as an `Authorization: Bearer <token>` header on every request — the global `JwtAuthGuard` rejects unauthenticated requests with 401.

After modifying `prisma/schema.prisma`, regenerate the client:
```bash
npx prisma generate
```

Run a single test file:
```bash
pnpm test --testPathPatterns=category
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
- `money-manager` — `account`, `category`, `movement`, `report` (the personal-finance ledger).
- `identity` — `auth` (user sign-up/sign-in).

### Module structure

```
src/modules/<domain>/<feature>/
├── domain/
│   ├── entities/           ← pure TypeScript classes, no framework deps
│   └── ports/              ← repository interfaces + injection Symbol
├── application/
│   ├── use-cases/          ← one file per use case, depend only on ports
│   └── shared/             ← cross-use-case application helpers (not use-case-specific, but still application-layer — e.g. `identity/auth`'s `buildAuthResponse()`)
├── infrastructure/
│   ├── controllers/        ← HTTP layer, calls use cases directly
│   ├── repositories/       ← Prisma implementations of domain ports
│   └── dto/                ← class-validator DTOs for request bodies
└── <feature>.module.ts
```

Cross-module imports (see "Cross-module dependencies" below) use the full path, e.g. `@modules/money-manager/account/application/use-cases/get-account-by-id.use-case`.

A feature with no persistence of its own (e.g. `report`, which only aggregates another feature's exported use case) skips `domain/` entirely — no entity or port to define — and keeps just `application/use-cases/` + `infrastructure/controllers/`. This is intentional, not a shortcut.

**Dependency rule (enforced):** `domain` → nothing. `application` → `domain` only. `infrastructure` → `application` + `domain`. Flag any import that violates this direction.

### Domain

- `src/domain/base.entity.ts` — `BaseEntity` abstract class with `id`, `createdAt`, `updatedAt` getters/setters; all domain entities extend this
- `src/domain/exceptions/domain.exception.ts` — `DomainException` base + `NotFoundException`, `ValidationException`, `ConflictException`
- `src/domain/enums/movement-type.enum.ts` — `MOVEMENT_TYPES` compile-time enum (see "Domain enums and constants")

### Infrastructure

- `src/infrastructure/exceptions/http-exception.filter.ts` — maps domain exceptions to HTTP status codes; registered globally in `main.ts`
- `src/infrastructure/interceptors/response.interceptor.ts` — wraps all successful responses as `{ statusCode, ...body }`; registered globally in `main.ts`
- `src/infrastructure/decorators/current-user.decorator.ts` — `@CurrentUser()`, reads the authenticated user the `JwtAuthGuard` attached to the request
- `src/infrastructure/guards/jwt-auth.guard.ts` — `JwtAuthGuard`, registered globally via `APP_GUARD` in `app.module.ts`

### Database

- **Prisma 7** with `@prisma/adapter-pg` (driver adapter required — not the legacy URL-only mode)
- Prisma client is generated to `src/infrastructure/config/database/generated/prisma/` (not `node_modules`)
- Import from `generated/prisma/client.js` (`.js` extension required by `moduleResolution: nodenext`)
- `PrismaModule` is `@Global()`, so `PrismaService` is available everywhere without importing `PrismaModule` per module
- `PrismaService` creates the adapter inside the constructor (not at module level) so `DATABASE_URL` is available from `dotenv`
- `prisma/seed.ts` is currently a no-op (logs and exits) — `MovementType` used to be the only seeded table and is now a compile-time enum (see "Domain enums and constants"); run with `tsx`

### Dependency injection for ports

Repository ports use a Symbol token, not the interface directly:

```ts
// port file exports both:
export interface AccountRepositoryPort { ... }
export const ACCOUNT_REPOSITORY = Symbol('AccountRepositoryPort');

// use case imports the interface as `import type` (required by isolatedModules):
import { ACCOUNT_REPOSITORY } from '...port';
import type { AccountRepositoryPort } from '...port';

// module wires the implementation:
{ provide: ACCOUNT_REPOSITORY, useClass: PrismaAccountRepository }
```

### Entity pattern

All entities extend `BaseEntity`, which provides `id`, `createdAt`, `updatedAt`. Each entity defines only its domain-specific fields:

```ts
// base.entity.ts
export type BaseEntityProps = { id?: string; createdAt?: Date; updatedAt?: Date };
export abstract class BaseEntity { /* id, createdAt, updatedAt getters/setters */ }

// feature entity
export type AccountProps = BaseEntityProps & { name: string; type: string; userId: string; isActive?: boolean };
export class AccountEntity extends BaseEntity {
  constructor(props?: AccountProps) {
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

Each use case defines its own response type (e.g. `CreateAccountResponse`) instead of reusing the entity plain type, so the response shape is explicit and decoupled from the domain.

**Create/Update/Delete return `{ id: string }` only** — never the full entity fields, even if the repository call returns more. `GetAll`/`GetById` use cases are unaffected and still return full mapped field sets.

### Domain enums and constants

Allowed-values lists (e.g. `ACCOUNT_TYPES`) live in `domain/enums/<name>.enum.ts`, never inline inside a use-case or a DTO. If both a DTO (`class-validator`'s `@IsIn`) and a use case need the same list, both import it from that single file — never duplicate the literal array.

### Business-rule validation must be symmetric

A rule enforced in `Create` (allowed value, referenced-id existence, etc.) must be enforced identically in `Update` whenever that field is being changed — do not rely solely on the DTO's `class-validator` decorators, since a use case can be invoked directly (from another module, a script, a future non-HTTP entrypoint) bypassing the DTO. The DTO is the first line of defense at the HTTP boundary; the use case is the one that actually holds the invariant.

### Delete semantics

Delete is always a real, physical row removal (`repository.delete(entity): Promise<void>`) — never a soft-delete-via-flag. If the entity has an `isActive`-style boolean, it exists purely as a manual toggle exposed through `Update`, unrelated to `Delete`.

Before deleting, the use case must check every place elsewhere in the schema that references this entity (every FK pointing at it) and throw a `ValidationException` if any reference count is > 0 — never let the DB's `onDelete: Restrict` constraint surface as a raw Prisma error. If nothing in the schema references the entity, no guard is needed.

### Cross-module dependencies

A module exports **only use cases** in its `exports` array — never a repository Symbol token. When one feature needs to read/validate data owned by another feature (e.g. `Movement` validating `accountId`/`categoryId`), the consuming module imports the owning feature's `Module` and injects one of its exported use cases via normal Nest DI (no `@Inject` needed for a concrete class token). The owning module adds a `GetXById`-style use case (throws `NotFoundException` when missing, returns mapped fields) purely to serve this purpose if one doesn't already exist. `movementType` is not a cross-module case: it's a plain string column validated against the shared `MOVEMENT_TYPES` enum (`src/domain/enums/movement-type.enum.ts`), the same `@IsIn`-at-the-DTO-plus-symmetric-use-case-revalidation pattern as `Account.type` — no other module's use case is involved.

### Authentication and data ownership

Better-Auth was removed and fully replaced by hand-rolled JWT auth — no Passport, no `@nestjs/passport`, no strategy classes. Auth is built from two direct dependencies: `@nestjs/jwt` (the official thin Nest wrapper around `jsonwebtoken` — signing/verification only) for tokens, and `argon2` for password hashing. The `identity/auth` module (`src/modules/identity/auth/`) follows the same hexagonal layering as every `money-manager` feature and exposes two public endpoints: `POST /auth/sign-up` (creates the user, hashes the password, returns `{ id, accessToken }`) and `POST /auth/sign-in` (verifies credentials, returns the same shape). A global `JwtAuthGuard` (`src/infrastructure/guards/jwt-auth.guard.ts`, registered via `APP_GUARD` in `app.module.ts`) protects every Nest-routed endpoint by default; a route opts out with the `@Public()` decorator (`src/infrastructure/decorators/public.decorator.ts`), which the guard checks first via `Reflector.getAllAndOverride`. On a valid token the guard sets `request.user` to match the `RequestWithUser`/`AuthenticatedRequest` shape in `src/infrastructure/decorators/current-user.decorator.ts`. `JwtModule` is registered `global: true` in `app.module.ts` so `JwtService` is injectable everywhere without every module re-importing it. Both `signOptions` and `verifyOptions` pin `algorithm`/`algorithms` to `['HS256']` explicitly — don't rely on jsonwebtoken's own default never changing. Required env vars: `JWT_SECRET` (required) and `JWT_EXPIRES_IN` (optional, defaults to `'2h'` in the `JwtModule.registerAsync` factory, not in `EnvironmentVariables`). `JWT_EXPIRES_IN`, when set, is validated at boot in `EnvironmentVariables` (`src/infrastructure/config/env/environment-variables.ts`) with a `@Matches` regex accepting a plain integer-seconds string or an `ms`-style duration (`"2h"`, `"10m"`, `"7d"`, etc.) — a malformed value now fails fast at boot instead of throwing inside `jwtService.signAsync()` on the first real sign-up/sign-in.

`argon2.verify()` throws a raw `TypeError` (not a boolean `false`) when the stored hash is empty or not a valid PHC-formatted string, instead of returning a clean mismatch — `SignInUseCase` wraps the call in try/catch and maps any throw to the same `UnauthorizedException` used for a normal wrong-password case, so a malformed/empty hash never surfaces as a 500 or leaks which part of the credential was invalid.

`SignUpUseCase` first checks `findByEmail` for a friendly `ConflictException` on the common case, but that check alone is a TOCTOU race — two concurrent sign-ups for the same email can both pass it. `PrismaUserRepository.create()` closes the race by catching the Prisma unique-constraint violation (error code `P2002`) from the losing `create()` call and throwing `ConflictException` itself, so the use case doesn't need to know about Prisma error codes at all. The check is duck-typed (`'code' in error && error.code === 'P2002'`), not `error instanceof Prisma.PrismaClientKnownRequestError` — a real *value* import of the generated Prisma client (as opposed to every other repository's `import type`) makes ts-jest try to transform `client.ts`'s genuine ESM (`import.meta.url`), which fails to parse under ts-jest's CommonJS transform (the same ESM constraint documented above for why e2e specs need `@swc/jest` instead of `ts-jest`).

`POST /auth/sign-up` and `POST /auth/sign-in` are rate-limited via `@nestjs/throttler` (5 requests/60s per IP — a real brute-force deterrent, not sized to fit the e2e suite's own call count), scoped to `AuthModule` only — `ThrottlerModule.forRoot(...)` is imported inside `auth.module.ts` (not registered globally in `app.module.ts`), and `@UseGuards(ThrottlerGuard)` is applied directly on `AuthController`, so no other route in the app is affected. This rate limit is only as strong as `main.ts`'s `trust proxy` config: `@nestjs/throttler`'s default `ThrottlerGuard.getTracker` keys the bucket off `req.ip`, which Express only resolves correctly through `X-Forwarded-For` when `app.set('trust proxy', ...)` names the exact hops in front of it. `getTrustedProxies()` (`src/infrastructure/config/env/get-trusted-proxies.ts`) sources this from `TRUSTED_PROXIES` (comma-separated IPs/CIDRs, same split/trim/filter parsing as `CORS_ORIGINS`), defaulting to the standard RFC1918 private ranges (`10.0.0.0/8,172.16.0.0/12,192.168.0.0/16`) for the current single-container Dokploy setup where the reverse proxy sits on the same private Docker network — without it, either every client collapses into one shared bucket (one abusive client locks out everyone) or, naively enabled without restricting to known hops, `X-Forwarded-For` becomes spoofable and the limit is trivially evaded. `ThrottlerModule`'s storage stays at its default (in-memory), which only works correctly for a single replica — the counters aren't shared across processes, so revisit (e.g. a Redis-backed `ThrottlerStorage`) only if this app is ever scaled to multiple replicas.

`SignUpUseCase` and `SignInUseCase` both need the identical JWT-payload-building + `{ id, accessToken }` response-shaping step once a user is authenticated — that's extracted into `buildAuthResponse()` (`src/modules/identity/auth/application/shared/build-auth-response.ts`) instead of duplicated per use case.

`SignInUseCase` guards against an email-enumeration timing side-channel: without it, an unknown email would return immediately while a known email pays argon2.verify()'s deliberate CPU cost, letting an attacker infer whether an email is registered from response-time alone. The unknown-email branch runs `argon2.verify()` against a fixed dummy hash (result discarded) before throwing, so both branches take comparable time.

A deleted or deactivated user's still-unexpired JWT continues to authenticate successfully — `JwtAuthGuard` only verifies the token's signature/expiry, it never re-checks the database. This is an accepted stateless-JWT tradeoff (no revocation list), not a bug.

`Account`, `Category`, and `Movement` are owned by a `User` (`userId` FK, `onDelete: Cascade`). `MovementType` is not a database entity at all — it is a compile-time enum (`MOVEMENT_TYPES` in `src/domain/enums/movement-type.enum.ts`, `['Gasto', 'Ingreso', 'Transferencia']`), so `Category.movementType` and `Movement.movementType` are plain `String` columns validated against that enum, not a `userId`-scoped or global FK relationship.

For every ownership-scoped entity: `GetAllUseCase.execute(userId)`, `GetByIdUseCase.execute(id, userId)`, and the repository's `findById`/`findAllWithBalance`-style methods filter by `WHERE id = ? AND userId = ?` (via `findFirst`, not `findUnique`, since `id` alone is no longer sufficient to scope the row) — a lookup for another user's row returns `null` → `NotFoundException`, the same as a truly missing id. Never leak existence via a 403; a wrong-owner id and a nonexistent id must be indistinguishable to the caller. `Create`/`Update`/`Delete` commands carry `userId` as a required constructor param, sourced from `@CurrentUser()` (`src/infrastructure/decorators/current-user.decorator.ts`) in the controller — never trust a `userId` from the request body/DTO.

Cross-module ownership checks matter just as much as same-module ones: `Movement`'s use cases call `GetAccountByIdUseCase.execute(accountId, userId)` and `GetCategoryByIdUseCase.execute(categoryId, userId)` (and `toAccountId` too, for transfers) so a user can't reference another user's account/category in their own movement. `movementType` needs no such lookup — it is validated in-process against the compile-time `MOVEMENT_TYPES` enum, not fetched from another module or scoped by `userId`.

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
