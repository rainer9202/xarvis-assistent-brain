# Proposal: Authenticated User Profile Endpoints

## Intent

The API exposes no way to read or edit the authenticated user's profile. The frontend only holds the user snapshot returned by `POST /auth/sign-in`/`sign-up` (persisted in `store/session-store.ts`) and never refreshes it. `birthDate` can only be set at sign-up (`SignUpDto`); there is no way to correct it or edit `name`/`email` afterward, so the Perfil screen is read-only. This is the single real functional gap in the backlog. Add `GET /auth/me` (read) and `PATCH /auth/me` (partial update) to the `identity/auth` module.

## Scope

### In Scope
- `GET /auth/me` → authenticated user's `{ id, name, email, birthDate }`; `401` on missing/expired token via the global `JwtAuthGuard` (no `@Public()`).
- `PATCH /auth/me` → partial update of `name` and/or `birthDate` only; `email`/`password` silently stripped (`whitelist: true`), not rejected.
- Extend `UserRepositoryPort` + `PrismaUserRepository` with `findById(id)` and `update(entity)`.
- Unit + e2e tests (Strict TDD is enabled).

### Out of Scope
- Editing `email` or `password` (deferred; needs uniqueness/re-auth handling).
- Refresh-token endpoint, account deletion, avatars.
- Any Prisma schema/migration change — `User` already has `name`/`email`/`birthDate` columns.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `auth`: adds two requirements to the auth capability — retrieve authenticated profile (`GET /auth/me`) and update authenticated profile (`PATCH /auth/me`). Delta spec; baseline auth spec otherwise covers sign-up/sign-in.

## Approach

Follow the module's hexagonal layering. Two new use cases (`GetProfileUseCase`, `UpdateProfileUseCase`), each with its own mapped response type. Both take `userId` from `@CurrentUser()` — never the body. Because `@CurrentUser()` exposes only `{ id, email, name }`, `birthDate` is NOT in the token; GET must load the full user via the new `findById`. The response mapper formats `birthDate` (`Date`) to a `YYYY-MM-DD` string (unlike `GetAllUsersUseCase`, which returns a raw `Date`). `UpdateProfileDto` declares optional `name` (`@IsString`, `@IsNotEmpty`, `@IsOptional`) and `birthDate` (`@IsDateString`, `@IsOptional`); omitted `email`/`password` are stripped by the global whitelist pipe. Update applies only fields present, then persists via `repository.update`. Register both use cases in `auth.module.ts`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `.../auth/infrastructure/controllers/auth.controller.ts` | Modified | Add protected `GET /auth/me` + `PATCH /auth/me` handlers |
| `.../auth/application/use-cases/get-profile.use-case.ts` | New | Load user by id, map to profile response (date formatted) |
| `.../auth/application/use-cases/update-profile.use-case.ts` | New | Partial update of name/birthDate |
| `.../auth/infrastructure/dto/update-profile.dto.ts` | New | Optional name/birthDate; whitelist strips rest |
| `.../auth/domain/ports/user.repository.port.ts` | Modified | Add `findById(id)`, `update(entity)` |
| `.../auth/infrastructure/repositories/prisma-user.repository.ts` | Modified | Implement `findById`, `update` |
| `.../auth/auth.module.ts` | Modified | Provide new use cases |
| `test/**`, `**/*.spec.ts` | New | e2e + unit coverage (Strict TDD) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `birthDate` returned as raw `Date` instead of `YYYY-MM-DD` (as `GetAllUsers` does) | Med | Format to date-only string in the profile mapper; assert in e2e |
| Building profile from token alone (missing `birthDate`) | Med | GET loads full user via `findById`, not `@CurrentUser()` payload |
| `whitelist: true` not actually global → email/password not stripped | Low | Confirm global `ValidationPipe({ whitelist: true })` before spec |

## Rollback Plan

Additive change with no migration. Revert the single feature commit; the two new routes disappear and sign-up/sign-in are untouched. No data cleanup required.

## Dependencies

- Global `ValidationPipe({ whitelist: true })` must be active for the silent-strip behavior.

## Open Decision (for spec/design)

- `PATCH /auth/me` response shape is unspecified by the request. Repo convention says Update returns `{ id }` only, but the frontend refreshes its store after edit. Decide: return `{ id }` (convention) vs full updated profile (frontend convenience). Flagged, not resolved here.

## Success Criteria

- [ ] `GET /auth/me` returns `{ id, name, email, birthDate }` with `birthDate` as `YYYY-MM-DD`.
- [ ] Unauthenticated `GET`/`PATCH` return `401` (same shape as other protected routes).
- [ ] `PATCH /auth/me` updates only sent fields; single-field requests change only that field.
- [ ] `email`/`password` in the PATCH body are silently ignored, not rejected.
- [ ] Unit + e2e suites green under Strict TDD.
