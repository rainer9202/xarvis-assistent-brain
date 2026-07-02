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

After modifying `prisma/schema.prisma`, regenerate the client:
```bash
npx prisma generate
```

Run a single test file:
```bash
pnpm test -- --testPathPattern=movement-type
```

## Architecture

Hexagonal architecture with one NestJS module per feature. Each module is fully self-contained.

### Module structure

```
src/modules/<feature>/
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

**Dependency rule (enforced):** `domain` → nothing. `application` → `domain` only. `infrastructure` → `application` + `domain`. Flag any import that violates this direction.

### Shared

- `src/shared/domain/base.entity.ts` — `BaseEntity` abstract class with `id`, `createdAt`, `updatedAt` getters/setters; all domain entities extend this
- `src/shared/exceptions/domain.exception.ts` — `DomainException` base + `NotFoundException`, `ValidationException`, `ConflictException`
- `src/shared/exceptions/http-exception.filter.ts` — maps domain exceptions to HTTP status codes; registered globally in `main.ts`
- `src/shared/interceptors/response.interceptor.ts` — wraps all successful responses as `{ statusCode, ...body }`; registered globally in `main.ts`
- `src/shared/decorators/` — custom decorators (currently empty)

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
