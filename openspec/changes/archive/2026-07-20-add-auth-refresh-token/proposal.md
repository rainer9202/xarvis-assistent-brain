# Proposal: Refresh Token + Logout Endpoints

## Intent

Auth issues a single stateless access token (`JWT_EXPIRES_IN`, default `7d`, HS256, no revocation of any kind). Clients cannot renew a session without re-entering credentials, and there is no way to invalidate a token — a leaked token stays valid for its full lifetime. Add persisted, rotated refresh tokens plus an on-demand revoke path so sessions can be renewed AND killed. This is the first security-sensitive backlog item (prior 3 changes were read-only GETs).

## Scope

### In Scope
- New `RefreshToken` Prisma model (hashed token, `userId`, `expiresAt`, `revokedAt`) + first migration in this SDD cycle.
- `POST /auth/refresh` (`@Public()`): rotate — validate presented refresh token, revoke it, issue NEW access + refresh token.
- `POST /auth/logout` (`@Public()`): revoke the presented refresh token (idempotent).
- Reuse detection: presenting an already-revoked token defensively re-revokes that single record and returns `401` (single-record only, no family cascade).
- `RefreshTokenRepositoryPort` + Symbol token + `PrismaRefreshTokenRepository`.
- New env vars `REFRESH_JWT_SECRET` (distinct from `JWT_SECRET`) and `REFRESH_JWT_EXPIRES_IN` (default `30d`), boot-validated in `EnvironmentVariables`.
- `sign-up`/`sign-in` responses extended to `{ id, accessToken, refreshToken }`.
- Unit + e2e tests (Strict TDD).

### Out of Scope
- Family/all-sessions cascade revocation on reuse (deliberately rejected — no session UI or monitoring to consume the signal).
- Cleanup cron for expired/revoked rows (accepted gap, mirrors in-memory `ThrottlerStorage` gap).
- Cookie delivery (no cookie infra; mobile-only JSON API).

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `auth`: adds refresh (`POST /auth/refresh`), logout (`POST /auth/logout`), and refresh-token issuance on sign-up/sign-in. Delta spec.

## Approach

Follow hexagonal layering. The refresh token is opaque/hashed at rest (only its hash stored, argon2/sha256 — design's call). On `POST /auth/refresh`: look up by hash → not found → `401`; found but `revokedAt` set → reuse trigger → re-revoke defensively, `401` (SAME status, no info leak, mirroring `SignInUseCase`'s timing-safe unknown-email handling); found + valid + unexpired → set `revokedAt = now()`, issue new access + new refresh row, return both. `/auth/refresh` stays `@Public()` — it is the one deliberate per-call DB touch; the global stateless `JwtAuthGuard` stays untouched. `POST /auth/logout` takes the refresh token in the request body and is `@Public()`: authority derives from possession of the refresh token, not a live access token — this lets a client log out AFTER its access token expires, and an attacker holding only a compromised access token (not the refresh token) cannot revoke sessions. Both endpoints stay under `AuthController`'s existing `ThrottlerGuard` (5 req/60s) — same brute-force/enumeration risk class as sign-in.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | New | `RefreshToken` model (first migration this cycle) |
| `.../auth/domain/ports/refresh-token.repository.port.ts` | New | Port + `REFRESH_TOKEN_REPOSITORY` Symbol |
| `.../auth/infrastructure/repositories/prisma-refresh-token.repository.ts` | New | Prisma impl |
| `.../auth/application/use-cases/refresh-token.use-case.ts` | New | Rotate + reuse detection |
| `.../auth/application/use-cases/logout.use-case.ts` | New | Idempotent revoke |
| `.../auth/application/shared/build-auth-response.ts` | Modified | Issue + return refresh token |
| `.../auth/infrastructure/controllers/auth.controller.ts` | Modified | `POST /auth/refresh` + `/auth/logout` |
| `.../auth/infrastructure/dto/*` | New | Refresh/logout body DTOs |
| `.../auth/auth.module.ts` | Modified | Wire port + use cases |
| `environment-variables.ts` | Modified | `REFRESH_JWT_SECRET`, `REFRESH_JWT_EXPIRES_IN` |
| `test/**` | New | e2e + unit (Strict TDD) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Reuse detection leaks via distinct status code | Med | Same `401` for not-found and revoked; re-revoke silently |
| Client keeps reusing original token after rotation (breaking change) | High | Contract: client MUST persist the LATEST refresh token each call; document + e2e assert |
| Expired/revoked rows accumulate forever | Med | Accepted gap — no cron this change; flag for future |
| Sharing signing key between token types | Low | Distinct `REFRESH_JWT_SECRET`, boot-validated |
| 30d default too long/short | Low | Env-configurable; design confirms default |

## Rollback Plan

Unlike the additive-only sibling changes, this adds a migration. Rollback is two parts: (1) revert the feature commit — new routes disappear, sign-up/sign-in return to `{ id, accessToken }`; (2) the `RefreshToken` table must be dropped via a down migration (`prisma migrate` down / manual `DROP TABLE refresh_tokens`). No existing table is altered, so no data loss on the `User` side. Design must specify the down migration explicitly.

## Dependencies

- `REFRESH_JWT_SECRET` (`MinLength(32)`) provisioned in every environment before deploy.
- `npx prisma generate` + `pnpm db:migrate` per AGENTS.md workflow; `prisma migrate deploy` before deploying.

## Success Criteria

- [x] `POST /auth/refresh` with a valid token returns a NEW access + NEW refresh token and revokes the old.
- [x] Reusing a rotated/revoked token returns `401`, indistinguishable from an unknown token.
- [x] `POST /auth/logout` revokes the token; a subsequent refresh with it returns `401`; logout is idempotent.
- [x] Sign-up/sign-in return `{ id, accessToken, refreshToken }`.
- [x] Missing/malformed `REFRESH_JWT_SECRET`/`REFRESH_JWT_EXPIRES_IN` fails fast at boot.
- [x] `refresh`/`logout` are `@Public()`. `JwtAuthGuard` gained one minimal additive check (rejects `payload.type === 'refresh'` on any protected route) as a deliberate defense-in-depth measure — see design.md's "token-confusion defense in depth" ADR; this is a justified, reviewed security hardening, not scope creep, and does not change the guard's behavior for any legitimate access token.
- [x] Unit + e2e suites green under Strict TDD.
