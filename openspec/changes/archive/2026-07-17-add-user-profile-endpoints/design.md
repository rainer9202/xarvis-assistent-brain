# Design: Authenticated User Profile Endpoints

Architectural design (the HOW) for `GET /auth/me` and `PATCH /auth/me` in
`src/modules/identity/auth`. Task breakdown is deferred to `sdd-tasks`.

## 1. Architecture Approach

No new pattern is introduced. The change extends the existing hexagonal
`identity/auth` module along its three established layers, mirroring the
conventions already proven by `SignUpUseCase` / `SignInUseCase` and the
`money-manager` features:

- **domain** — extend `UserRepositoryPort` with two read/write methods; no
  new entity (the `User` columns already exist).
- **application** — two new single-purpose use cases plus one shared response
  mapper, following the exact `buildAuthResponse()` precedent for cross-use-case
  application helpers under `application/shared/`.
- **infrastructure** — two new protected controller handlers, one new PATCH
  DTO, and the Prisma implementations of the two new port methods.

The dependency direction (`domain → nothing`, `application → domain`,
`infrastructure → application + domain`) is preserved. Both use cases take
`userId` from `@CurrentUser()`, never from the request body — consistent with
the ownership rule in AGENTS.md.

### Component map

```
infrastructure/controllers/auth.controller.ts   [MOD] GET /me, PATCH /me handlers
infrastructure/dto/update-profile.dto.ts         [NEW] optional name/birthDate
application/use-cases/get-profile.use-case.ts     [NEW] hydrate by id → mapper
application/use-cases/update-profile.use-case.ts  [NEW] partial update → mapper
application/shared/build-user-profile.ts          [NEW] UserEntity → profile DTO
domain/ports/user.repository.port.ts              [MOD] findById(id), update(entity)
infrastructure/repositories/prisma-user.repository.ts [MOD] implement both
auth.module.ts                                    [MOD] provide both use cases
```

### Data flow

GET:
```
HTTP GET /auth/me  (Bearer token)
  → JwtAuthGuard (global) verifies token, sets request.user = {id,email,name}
  → AuthController.getMe(@CurrentUser() user)
  → GetProfileUseCase.execute({ userId: user.id })
  → repository.findById(userId)  → UserEntity | null (null → NotFoundException)
  → buildUserProfile(entity)     → { id, name, email, birthDate: 'YYYY-MM-DD'|null }
  → ResponseInterceptor wraps → { statusCode, message, data }
```

PATCH:
```
HTTP PATCH /auth/me  (Bearer token, body {name?, birthDate?, [email/password stripped]})
  → global ValidationPipe(whitelist) strips unknown keys (email/password) silently
  → JwtAuthGuard sets request.user
  → AuthController.updateMe(@CurrentUser() user, @Body() dto)
  → UpdateProfileUseCase.execute({ userId, name?, birthDate? })
  → repository.findById(userId)          → UserEntity | null (null → NotFoundException)
  → mutate ONLY the fields present in the command
  → repository.update(entity)            → persists name/birthDate only
  → buildUserProfile(updated)            → SAME shape as GET
  → ResponseInterceptor wraps
```

## 2. Decisions (ADR-style)

### ADR-1 — Extend `UserRepositoryPort` with `findById`, do NOT read birthDate from the token

**Context.** `@CurrentUser()` / the JWT payload expose only `{ id, email, name }`
(`current-user.decorator.ts`, `jwt-auth.guard.ts`). `birthDate` is not in the
token. No `findById` exists on `UserRepositoryPort` today (only `findByEmail`,
`findAll`, `create`).

**Decision.** Add `findById(id: string): Promise<UserEntity | null>` to the port
and implement it in `PrismaUserRepository` via `prisma.user.findUnique({ where: { id } })`.
GET hydrates the full user through it.

**Rationale.** Building the profile from the token alone would silently omit
`birthDate` (a flagged proposal risk). `findUnique` on `id` is correct here —
unlike `Account`/`Category`/`Movement`, `User` is the ownership *root*, so it is
scoped by its own `id` alone, NOT by a second `userId` filter. There is no
"other user's row" case: the id comes from the caller's own verified token.

**Rejected.** (a) Reuse `findByEmail` — token has email but this couples profile
loading to an incidental field and still needs a query. (b) Enrich the JWT with
`birthDate` — bloats every token, forces re-issue on edit, and leaves stale
`birthDate` in existing tokens after PATCH.

**Defensive null.** `findById` returning `null` maps to `NotFoundException`. This
is not dead code: AGENTS.md documents that a deleted user's unexpired JWT still
authenticates (stateless-JWT tradeoff), so a valid token for a since-deleted row
is reachable and must yield 404, not a 500.

### ADR-2 — birthDate formatted to `YYYY-MM-DD` in one shared application mapper

**Context.** `birthDate` is a `Date` in the entity (`sign-up` does
`new Date(command.birthDate)`). `GetAllUsersUseCase` returns the raw `Date`
(a flagged inconsistency). GET and PATCH must return an identical, stable shape.

**Decision.** Introduce `application/shared/build-user-profile.ts` exporting a
`UserProfileResponse` type and `buildUserProfile(user: UserEntity): UserProfileResponse`.
It maps `{ id, name, email }` and formats `birthDate` to a date-only string
(`null` when absent). Both `GetProfileUseCase` and `UpdateProfileUseCase` call it,
guaranteeing byte-identical shape.

```ts
export type UserProfileResponse = {
  id: string;
  name: string;
  email: string;
  birthDate: string | null; // 'YYYY-MM-DD'
};
```

**Formatting.** Use `date.toISOString().slice(0, 10)`. This is consistent with how
sign-up stores the value: `new Date('1990-05-20')` parses as UTC midnight, so the
round-trip yields exactly `'1990-05-20'`.

**Rationale.** Placing the mapper in `application/shared/` (not in a DTO, not on
the entity, not in the infra layer) mirrors the established `buildAuthResponse()`
precedent for logic shared by multiple use cases. The domain entity stays a pure
`Date` holder; formatting is a response concern owned by the application layer.
`GetAllUsersUseCase` is intentionally left untouched (a debug-only route, out of
scope) — this change does not retro-fix it, but the new mapper is the template if
that alignment is ever wanted.

**Timezone gotcha (call out in tests).** `toISOString()` is UTC. It is correct
only because birthDate is persisted as UTC-midnight by the sign-up path. If a
future path stores a non-midnight or local-tz `Date`, `slice(0,10)` could drift by
a day. The e2e assertion (sign up with a known date, read it back) pins this.

**Rejected.** Formatting inside the DTO (DTOs here validate *input*, not shape
output) or on the entity getter (pollutes the domain with a presentation format).

### ADR-3 — PATCH partial-update shape; email/password stripped by the GLOBAL whitelist

**Context.** Proposal risk: "`whitelist: true` may not be global." **Verified
against real config**: `main.ts:39` registers
`new ValidationPipe({ whitelist: true, transform: true })` globally.
`forbidNonWhitelisted` is NOT set.

**Decision.** `UpdateProfileDto` declares only:

```ts
@IsOptional() @IsString() @IsNotEmpty()  name?: string;
@IsOptional() @IsDateString()            birthDate?: string;
```

`email` / `password` are simply absent from the DTO. With `whitelist: true` and
`forbidNonWhitelisted` unset, unknown body keys are **stripped silently** — the
request still succeeds (200), the extra fields never reach the use case. This is
exactly the required behavior (silent ignore, not 400). Had
`forbidNonWhitelisted` been true it would 400; it is not, so the proposal's
success criterion holds without any per-DTO change.

**Use case.** `UpdateProfileUseCase` receives an `UpdateProfileCommand(userId, name?, birthDate?)`.
It loads the entity via `findById`, then applies **only the fields present**
(`if (command.name !== undefined) entity.name = command.name`; same for
`birthDate` → `new Date(command.birthDate)`), then calls `repository.update(entity)`.
Sending a single field changes only that field; the untouched column keeps its
current value because the entity was hydrated first.

**`repository.update`.** `prisma.user.update({ where: { id }, data: { name, birthDate } })`
— the `data` includes ONLY `name` and `birthDate`, never `email`/`password`, so
those columns are structurally impossible to change through this path even if a
future caller bypassed the DTO.

**Symmetric-validation note.** AGENTS.md requires Create-rules re-enforced in
Update. Here the only invariants are `name` non-empty and `birthDate` a valid date
— both pure field-shape checks with no cross-entity/allowed-value logic, so the
DTO decorators plus `new Date(...)` cover them; no extra use-case guard is
warranted. There is no ownership or referenced-id rule to duplicate (User is the
root).

**Rejected.** Adding `forbidNonWhitelisted` per-DTO (would 400 instead of the
required silent strip) or a three-state null handling for birthDate (clearing
birthDate is out of scope per the proposal).

### ADR-4 — PATCH returns the FULL updated profile (documented exception to `{ id }` convention)

**Context.** AGENTS.md convention #9: Create/Update/Delete return `{ id }` only.
The proposal left this as an open decision; the post-proposal decision is that
PATCH returns the full profile so the frontend can refresh its `session-store`
snapshot without a follow-up GET.

**Decision.** `UpdateProfileUseCase` returns `UserProfileResponse` (the same
`buildUserProfile(...)` output as GET), NOT `{ id }`.

**Rationale.** This is a **deliberate, documented exception**, in the exact same
spirit as `SignUpUseCase` returning `{ id, accessToken }` instead of `{ id }`
(already an accepted precedent in this codebase). The client mutates its local
profile store immediately after edit; returning the canonical server state in one
round-trip avoids a read-after-write and guarantees the client shows exactly what
was persisted (including the normalized `YYYY-MM-DD` birthDate). Reusing the GET
mapper keeps the two responses provably identical.

**Callout for review.** Automated review rule #9 will flag an Update returning
more than `{ id }`. This is expected — annotate the use case with a short comment
citing this ADR and the `SignUpResponse` precedent so the exception reads as
intentional, exactly as `sign-up.use-case.ts` already documents its own.

### ADR-5 — Route placement and auth: `/auth/me` in `AuthController`, protected by the global `JwtAuthGuard`

**Context.** `JwtAuthGuard` is registered globally via `APP_GUARD` in
`app.module.ts`; every route is protected unless it carries `@Public()`.

**Decision.** Add `@Get('me')` and `@Patch('me')` handlers to the existing
`AuthController` (alongside `sign-up`/`sign-in`). Do **NOT** add `@Public()`. No
explicit `@UseGuards(JwtAuthGuard)` is needed — the global guard already applies.
Missing/expired token → `401` (same shape as every other protected route), which
satisfies the proposal's 401 criterion with zero extra code.

**Rationale.** These are the authenticated user's own profile routes; they belong
in the auth controller next to the identity endpoints. The guard is already global,
so protection is the default and only opting out (`@Public()`) would be a mistake.

### ADR-6 — Throttler scope (DISCOVERY / decision required)

**Discovery.** `@UseGuards(ThrottlerGuard)` is applied at the **class level** on
`AuthController` (5 requests / 60s per IP), intended only for the brute-force-prone
`sign-up`/`sign-in`. Adding `GET`/`PATCH /auth/me` to the same controller means
they **inherit that 5-req/60s limit** — likely too tight for a profile screen that
may read on focus/refresh, and a source of intermittent `429`s in e2e.

**Decision.** Narrow throttling to the credential routes and exempt the profile
routes. Preferred: keep the class-level guard but add `@SkipThrottle()`
(`@nestjs/throttler`) on the two `me` handlers. Alternative: move
`@UseGuards(ThrottlerGuard)` from the class down onto only `signUpOne`/`signInOne`.
Either keeps the existing brute-force protection on credentials unchanged while
freeing `/auth/me`.

**Rationale.** The rate limit exists specifically as a credential brute-force
deterrent (AGENTS.md); applying it to profile reads is an unintended side effect of
class-level placement, and would also force new e2e tests to burn unique
`X-Forwarded-For` IPs per request just to avoid false `429`s. `@SkipThrottle()` on
the two handlers is the smallest, most local change and leaves the documented
`sign-up`/`sign-in` behavior byte-for-byte intact.

**Flag for tasks.** This must be an explicit task item; without it the e2e suite
for `/auth/me` is throttle-fragile.

## 3. Integration Points

- **`auth.module.ts`** — add `GetProfileUseCase` and `UpdateProfileUseCase` to
  `providers`. No `exports` change (not consumed cross-module). `USER_REPOSITORY`
  binding is unchanged.
- **Prisma** — no schema/migration change; `name`/`email`/`birthDate` columns
  already exist. `findById` uses `findUnique`; `update` targets `where: { id }`.
- **Response envelope** — controllers return `{ message, data }`; the global
  `ResponseInterceptor` injects `statusCode`. Both new handlers follow this.
- **DomainExceptionFilter** — `NotFoundException` (domain) from `findById`-null is
  mapped to HTTP 404 by the existing global filter; no new wiring.

## 4. Test Surfaces Implied (Strict TDD — for `sdd-tasks` to slice)

Unit (jest, `ts-jest`, mocked repository):
- `build-user-profile.spec.ts` — maps fields; formats `birthDate` to
  `YYYY-MM-DD`; returns `null` birthDate when entity value is null/undefined;
  verifies UTC round-trip of a known date.
- `get-profile.use-case.spec.ts` — `findById` hit → mapped profile with formatted
  date; `findById` → `null` → `NotFoundException`.
- `update-profile.use-case.spec.ts` — partial update paths: name-only, birthDate-only,
  both; asserts `repository.update` receives the merged entity with untouched
  fields preserved; asserts return equals the full `UserProfileResponse` (ADR-4);
  `findById` → `null` → `NotFoundException`.

e2e (jest, `@swc/jest`, real docker-compose Postgres per AGENTS.md; every request
uses `createAuthenticatedUser(app)` Bearer token):
- `GET /auth/me` → 200, `{ id, name, email, birthDate: 'YYYY-MM-DD' }` matching the
  signed-up user; birthDate assertion pins the date-format contract.
- `GET /auth/me` with no token → 401 (global guard).
- `PATCH /auth/me` name-only → 200, full profile, only name changed.
- `PATCH /auth/me` birthDate-only → 200, birthDate reflected as `YYYY-MM-DD`.
- `PATCH /auth/me` with `email`/`password` in the body → 200 (NOT 400), those
  values ignored/unchanged (proves global whitelist strip — ADR-3).
- `PATCH /auth/me` with no token → 401.
- (After ADR-6) confirm `/auth/me` routes are exempt from the 5-req/60s throttle so
  the suite is not throttle-fragile.

## 5. Risks / Assumptions Carried Forward

- **Throttler placement (ADR-6)** is an active decision that MUST land as a task;
  otherwise `/auth/me` inherits the credential rate limit.
- **birthDate UTC formatting (ADR-2)** is correct only while birthDate is persisted
  as UTC-midnight (current sign-up behavior). e2e pins it; revisit if a local-tz
  write path is ever added.
- **PATCH-returns-full-profile (ADR-4)** intentionally violates review rule #9 —
  needs an inline comment citing the exception so review/`judgment-day` reads it as
  deliberate.
- Assumes no additional profile fields (avatar/email/password edits) — all
  explicitly out of scope per the proposal.
