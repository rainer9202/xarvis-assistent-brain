# Tasks: Authenticated User Profile Endpoints (GET/PATCH /auth/me)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~350-420 (8 files touched: 5 new, 3 modified; incl. unit + e2e tests) |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

Rationale: change is contained to one module (`identity/auth`), no migration, no cross-module wiring. Line estimate sits near but likely under 400; flagged Medium (not Low) because unit + e2e test code typically doubles implementation LOC. Recommend proceeding as a single PR, but orchestrator should confirm actual diff size after Phase 2-3 before requiring `size:exception`.

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Full feature (domain port + mapper + use cases + controller + DTO + tests) | PR 1 | Single PR; no natural seam justifies splitting a 2-endpoint, 1-module change |

## Phase 1: Foundation (Port + Repository)

- [x] 1.1 Add `findById(id: string): Promise<UserEntity | null>` and `update(entity: UserEntity): Promise<UserEntity>` to `UserRepositoryPort` (`src/modules/identity/auth/domain/ports/user.repository.port.ts`) — ADR-1
- [x] 1.2 RED: write `prisma-user.repository.spec.ts` cases for `findById` (found/null) and `update` (maps name/birthDate only)
- [x] 1.3 GREEN: implement `findById` (`prisma.user.findUnique({ where: { id } })`) and `update` (`prisma.user.update({ where: { id }, data: { name, birthDate } })`) in `PrismaUserRepository` (`src/modules/identity/auth/infrastructure/repositories/prisma-user.repository.ts`)

## Phase 2: Application Layer (Mapper + Use Cases)

- [x] 2.1 RED: write `build-user-profile.spec.ts` — maps `{id,name,email}`, formats `birthDate` to `YYYY-MM-DD`, returns `null` when birthDate is null/undefined, pins UTC round-trip of a known date — ADR-2
- [x] 2.2 GREEN: create `application/shared/build-user-profile.ts` exporting `UserProfileResponse` type and `buildUserProfile(user: UserEntity): UserProfileResponse` using `date.toISOString().slice(0, 10)`
- [x] 2.3 RED: write `get-profile.use-case.spec.ts` — `findById` hit → mapped profile; `findById` → null → `NotFoundException`
- [x] 2.4 GREEN: create `GetProfileUseCase` (`application/use-cases/get-profile.use-case.ts`) calling `repository.findById` then `buildUserProfile`
- [x] 2.5 RED: write `update-profile.use-case.spec.ts` — name-only, birthDate-only, both fields; asserts `repository.update` receives merged entity with untouched fields preserved; asserts return is the full `UserProfileResponse` (ADR-4); `findById` → null → `NotFoundException`
- [x] 2.6 GREEN: create `UpdateProfileUseCase` (`application/use-cases/update-profile.use-case.ts`): hydrate via `findById`, apply only fields present in the command, `repository.update`, return `buildUserProfile(updated)`
- [x] 2.7 Add inline comment on `UpdateProfileUseCase`'s return statement citing ADR-4 and the `SignUpUseCase`/`SignUpResponse` precedent, documenting the deliberate exception to the `{ id }`-only Update convention (AGENTS.md rule #9) so automated review reads it as intentional

## Phase 3: Infrastructure (DTO + Controller + Wiring)

- [x] 3.1 Create `UpdateProfileDto` (`infrastructure/dto/update-profile.dto.ts`): `@IsOptional() @IsString() @IsNotEmpty() name?: string` and `@IsOptional() @IsDateString() birthDate?: string` — no `email`/`password` fields (ADR-3)
- [x] 3.2 Add `@Get('me')` handler to `AuthController` calling `GetProfileUseCase` with `@CurrentUser()` id; no `@Public()`, no extra `@UseGuards` (global `JwtAuthGuard` applies) — ADR-5
- [x] 3.3 Add `@Patch('me')` handler to `AuthController` calling `UpdateProfileUseCase` with `@CurrentUser()` id and `@Body() dto: UpdateProfileDto`
- [x] 3.4 Add `@SkipThrottle()` decorator (from `@nestjs/throttler`) to both `getMe` and `updateMe` handlers to opt out of the class-level `ThrottlerGuard` (5 req/60s) inherited from `AuthController`, which is scoped for sign-up/sign-in brute-force protection, not profile reads/edits — ADR-6
- [x] 3.5 Register `GetProfileUseCase` and `UpdateProfileUseCase` in `auth.module.ts` providers (no `exports` change needed)

## Phase 4: e2e Verification (real docker-compose Postgres)

- [x] 4.1 In `test/identity/auth.e2e-spec.ts`, add `GET /auth/me` → 200 with `{ id, name, email, birthDate: 'YYYY-MM-DD' }` matching the signed-up user (via `createAuthenticatedUser(app)`) — implemented via a local `signUpProfileUser()` helper (direct `/auth/sign-up` with an explicit `birthDate`) rather than the shared `createAuthenticatedUser(app)`, which doesn't send `birthDate` — see Deviations note below
- [x] 4.2 Add `GET /auth/me` with no token → 401
- [x] 4.3 Add `PATCH /auth/me` name-only → 200, full profile returned, only `name` changed
- [x] 4.4 Add `PATCH /auth/me` birthDate-only → 200, `birthDate` reflected as `YYYY-MM-DD`
- [x] 4.5 Add `PATCH /auth/me` with `email`/`password` in body → 200 (not 400), those values ignored/unchanged (proves global whitelist strip, ADR-3)
- [x] 4.6 Add `PATCH /auth/me` with no token → 401
- [x] 4.7 Add assertion (in `test/auth-rate-limit.e2e-spec.ts`) confirming `/auth/me` GET/PATCH are exempt from the 5-req/60s throttle, proving ADR-6's `@SkipThrottle()` works and the suite isn't throttle-fragile

## Phase 5: Verification

- [x] 5.1 Run `pnpm typecheck` and `pnpm lint` — both clean (0 errors; lint warnings are pre-existing, unrelated to this change)
- [x] 5.2 Run `pnpm test` (unit) — all 427 tests pass (73 suites)
- [x] 5.3 Run `pnpm test:e2e` against the docker-compose `db` service — all new Phase 4 scenarios pass (6/6 in `identity/auth.e2e-spec.ts`, 3/3 in `auth-rate-limit.e2e-spec.ts`, including the ADR-6 throttle-exemption assertion). See "Deviations / Known Issues" below for pre-existing, unrelated e2e failures discovered during this run.

## Deviations / Known Issues (discovered during apply, out of scope to fix here)

- `SignUpDto.birthDate` is a required field (`@IsNotEmpty() @IsDateString()`), but the shared e2e helper `test/utils/test-app.ts`'s `createAuthenticatedUser(app)` signs up without sending `birthDate`, and so do several pre-existing tests in `test/identity/auth.e2e-spec.ts`. This causes those calls to fail with 400 instead of 201 — a **pre-existing, repo-wide bug** that affects the *entire* e2e suite (every module's e2e spec that calls `createAuthenticatedUser`), not just auth. It was already present before this change and is unrelated to the profile endpoints; fixing it would touch unrelated sign-up code/shared test infra and was left out of this change's scope. Recommend a follow-up ticket. Confirmed via a scratch debug test that the actual validation error is `["birthDate should not be empty", "birthDate must be a valid ISO 8601 date string"]`.
- Because of the above, this change's own new e2e tests use a local, self-contained `signUpProfileUser()` helper (in `identity/auth.e2e-spec.ts`) and an inline sign-up call with an explicit `birthDate` (in `auth-rate-limit.e2e-spec.ts`) instead of the shared broken helper, so they are unaffected by the pre-existing bug.
