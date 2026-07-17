# xarvis-assistent-brain — Project Context

**Project**: xarvis-assistent-brain  
**Date Initialized**: 2026-07-16  
**Persistence Mode**: openspec (file-based with Engram integration)  
**Strict TDD**: enabled (test runner available, integration tests required)

## Overview

xarvis-assistent-brain is a production NestJS backend API for a personal fitness/wellness application. It implements hexagonal architecture with multiple independent business domains (identity for auth, money-manager for financial tracking, gym-routine-sessions for workout features).

The codebase prioritizes:
- **Architectural clarity**: Strict dependency rules (domain → nothing, application → domain, infrastructure → both)
- **Type safety**: TypeScript with isolatedModules, nodenext module resolution, strict null checks
- **Data ownership**: Every entity scoped by userId; no cross-user data leaks
- **Business rule symmetry**: Same validation in Create and Update
- **Production resilience**: Real JWT auth (no Passport), argon2 password hashing, rate limiting, comprehensive e2e testing

## Tech Stack

| Category | Technology |
|----------|------------|
| **Runtime** | Node.js |
| **Framework** | NestJS 11 |
| **Language** | TypeScript 5.7 |
| **Package Manager** | pnpm |
| **Database** | PostgreSQL with Prisma 7 ORM |
| **Transpiler** | @swc/core (nest build) |
| **Type Checker** | tsc (strict mode) |
| **Testing** | Jest 30 (unit: ts-jest, e2e: @swc/jest) |
| **Linting** | ESLint 9 + typescript-eslint |
| **Code Formatting** | Prettier 3 |
| **Build Output** | ./dist, ./coverage |
| **Deployment Target** | Dokploy (containerized) |

## Architecture

### Module Structure

```
src/
├── domain/                          # Shared domain layer
│   ├── base.entity.ts              # BaseEntity (id, createdAt, updatedAt)
│   ├── exceptions/                 # DomainException, NotFoundException, etc.
│   └── enums/                      # Compile-time enums (MOVEMENT_TYPES, ACCOUNT_TYPES)
├── infrastructure/                  # Global infrastructure
│   ├── config/                     # Database, JWT, environment
│   ├── decorators/                 # @CurrentUser, @Public
│   ├── filters/                    # HttpExceptionFilter
│   ├── guards/                     # JwtAuthGuard (global)
│   └── interceptors/               # ResponseInterceptor (wraps { statusCode, data })
├── modules/
│   ├── identity/auth/              # JWT sign-up/sign-in (rate-limited)
│   ├── money-manager/
│   │   ├── account/                # Bank accounts with type & credit limit
│   │   ├── category/               # Expense categories (Gasto/Ingreso/Transferencia)
│   │   ├── movement/               # Transactions (owned by Account)
│   │   └── report/                 # Aggregations (no persistence)
│   └── gym-routine-sessions/       # Workout session tracking
└── app.module.ts                   # Root, registers global guards/interceptors
```

### Dependency Rules (Enforced)

- **Domain** → imports nothing framework-related
- **Application** → imports domain only (use cases, entities, exceptions)
- **Infrastructure** → imports application & domain (controllers, repos, DTOs)

**Violation Examples to Flag**:
- Domain importing from application/infrastructure
- Application importing infrastructure (e.g., Prisma directly)
- Controller touching repository or Prisma directly without going through use case

### Entity & Response Pattern

All domain entities extend `BaseEntity` (provides id, createdAt, updatedAt getters/setters).

Response shape (global via `ResponseInterceptor`):
```json
{ "statusCode": 200, "message": "...", "data": { ... } }
```

**Create/Update/Delete contracts**: return `{ id: string }` only (never full entity).  
**Get/GetAll contracts**: return mapped fields (not raw entity).

### Ownership Scoping

Every owned entity (Account, Category, Movement) has `userId` FK and `onDelete: Cascade`.

Rules:
- Use case receives `userId` from `@CurrentUser()` decorator (never trust request body)
- Repository methods: `findById(id, userId)` filter by `WHERE id = ? AND userId = ?`
- Missing or wrong-owner record → `NotFoundException` (not 403)
- Cross-module lookups call `GetXByIdUseCase(id, userId)` for validation

### Enums & Typed Constants

Code+label pattern used for display-sensitive enums:

```ts
export const MOVEMENT_TYPES = [
  { code: 'MT01', label: 'Gasto' },
  { code: 'MT02', label: 'Ingreso' },
  { code: 'MT03', label: 'Transferencia' },
] as const;
```

**Single source of truth rule**: No duplication across files; both DTO validation and use-case validation import `MOVEMENT_TYPE_CODES` from the same file.

### Monetary Amounts

All money stored as integer cents in the domain layer (never floats).

- Domain/application: `amountCents: number`
- Prisma storage: `Decimal` column
- Conversion: in repository `toEntity` mapper only (per-repository, intentionally not centralized)

### Validation Strategy

**Symmetric validation**: A business rule enforced in `Create` MUST be enforced identically in `Update`.

Example: `creditLimitCents` is required for `Account.type = 'AT03'`, forbidden otherwise — both `CreateAccountUseCase` and `UpdateAccountUseCase` check this, not just the DTO.

### Authentication & Authorization

- **Hand-rolled JWT** (no Passport): `@nestjs/jwt` + `argon2`
- **Global guard** (`JwtAuthGuard`): protects all routes by default; `@Public()` decorator opts out
- **Rate limiting**: 5 req/60s on `/auth/sign-up` and `/auth/sign-in` via `@nestjs/throttler`
- **Trust proxy config**: reads `TRUSTED_PROXIES` env var, defaults to RFC1918 ranges
- **No revocation**: Unexpired tokens remain valid even if user deleted (stateless JWT tradeoff)

## Testing

### Unit Tests

```bash
pnpm test           # Run all *.spec.ts (rootDir: src)
pnpm test:watch    # Watch mode
pnpm test:cov      # Coverage report
```

- **Transform**: ts-jest
- **Test environment**: node
- **Module resolution**: Jest moduleNameMapper configured for path aliases (@domain, @infra, @config, @modules)

### E2E Tests

```bash
pnpm test:e2e
```

**Requirements before first run**:
1. `docker-compose up -d db` (Postgres on localhost:5432)
2. `npx prisma migrate deploy` (apply migrations)
3. `pnpm db:seed` (upsert default user + categories)

**Harness** (`test/setup-env.ts`, wired via Jest `setupFiles`):
- Hardcodes `DATABASE_URL` to local docker-compose (ignores `.env`)
- Throws if remote DB credentials detected (safety)
- Every spec calls `createAuthenticatedUser(app)` → returns Bearer token
- All requests require `Authorization: Bearer <token>` header

**Transform**: @swc/jest (not ts-jest — Prisma 7 ships real ESM, ts-jest's CommonJS transform breaks it).

### Strict TDD Mode

**Enabled**: This project has a real test runner (Jest) with both unit and e2e layers, so strict TDD is enforced.

- All new code must be tested before merging
- E2E tests exercise real HTTP + Prisma + database
- Coverage reported per merge

## Build & Deployment

### Local Development

```bash
pnpm start:dev      # NestJS watch mode (hot reload)
pnpm build          # tsc type-check + nest build + tsc-alias
pnpm typecheck      # tsc --noEmit only (fast validation)
pnpm lint           # ESLint auto-fix
pnpm format         # Prettier write

pnpm db:migrate     # Prisma dev migrations
pnpm db:seed        # Seed default data
```

**Docker local**:
```bash
docker-compose up          # app:3000 + postgres:5432
docker-compose up --build  # rebuild after dependency changes
docker-compose down -v     # stop + wipe db volume
```

### Production (Dokploy)

- Containerized with `Dockerfile` (runtime stage targeted by default)
- Postgres managed by Dokploy (separate service, not in container)
- `DATABASE_URL` set via Dokploy environment variables
- Migrations run manually: `npx prisma migrate deploy` before deploy

## Key Gotchas & Conventions

### TypeScript Constraints

- `isolatedModules: true` → interfaces in decorated constructors need `import type`
- `moduleResolution: nodenext` → all local imports outside `src/` need `.js` extension
- `ts-node` incompatible with `nodenext` → use `tsx` for scripts (seed, etc.)

### Hot-Reload Zombie Process

Rapid sequential edits in `pnpm start:dev` can spawn multiple Node processes, leaving stale ones bound to :3000. Symptom: code compiles but API doesn't reflect changes (`.env` still old, field names stale, etc.).

**Fix**: `docker-compose logs app | grep EADDRINUSE` → if found, full recreate:
```bash
docker-compose up -d --build -V
```

### Optional Numeric Fields

Use `value == null` or `!== undefined`, never `!value` — a limit of exactly `0` is meaningful, not "unset."

### Falsy Reference Checks

Don't use `if (creditLimitCents)` to check if a credit limit is set. Use `creditLimitCents !== undefined && creditLimitCents !== null`.

### Cross-Module Lookup Ownership

When Module A's entity references Module B's entity (e.g., `Movement.accountId`), the consuming use case must call the owning module's `GetByIdUseCase(id, userId)` to enforce ownership scoping — never assume the FK exists or is owned by the same user.

## Review Priorities

The AGENTS.md file defines 14 mandatory review priorities. Highest priority:
1. Dependency rule violations (domain importing up the stack)
2. Missing `import type` on interface-only imports
3. Use cases returning entities directly vs. mapped response types
4. Controllers bypassing use-case layer
5. Ownership scoping missing or incomplete (returning 403 instead of 404)

## File Locations

- **Source code**: `src/`
- **Tests (unit)**: `src/**/*.spec.ts`
- **Tests (e2e)**: `test/**/*-spec.ts`
- **Database schema**: `prisma/schema.prisma`
- **Seed script**: `prisma/seed.ts`
- **Configuration**: `.env`, `.env.example`, environment-variables.ts
- **Type definitions**: `tsconfig.json`, `tsconfig.build.json`
- **SDD artifacts**: `openspec/changes/`, `openspec/config.yaml`
- **Skill registry**: `.atl/skill-registry.md`

## Next Steps

This init completes:
1. ✅ Tech stack detection (NestJS + Prisma + Jest)
2. ✅ Strict TDD enabled (test runner present)
3. ✅ openspec bootstrap (config.yaml, PROJECT_CONTEXT.md)
4. ✅ Skill registry validated

Ready for first SDD change via `/sdd-new`. Planned backlog (in priority order):
1. Auth profile endpoints (GET /auth/me, PATCH /auth/profile)
2. Session exercise counts (GET /sessions/:id/exercise-count)
3. Exercise progress history (GET /exercises/:id/progress)
4. Personal records (GET /exercises/records)
5. Refresh token endpoint (POST /auth/refresh)
6. List pagination (GET /movements?page=1&limit=20)
7. Workout session stats (GET /sessions/stats)
8. Exercise search (GET /exercises/search?q=...)
