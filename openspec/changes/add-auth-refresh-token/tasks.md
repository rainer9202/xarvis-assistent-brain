# Tasks: Refresh Token + Logout Endpoints

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~900-1100 (14 files: 9 new, 5 modified; Prisma migration, new use cases/repository/entity/port, guard change, env validator, plus unit + e2e tests) |
| 400-line budget risk | High |
| Chained work-unit commits recommended | Yes |
| Suggested split | 7 ordered work-unit commits (see below) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending — no-PR project; orchestrator only needs to confirm commit ordering, not a PR chain strategy |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

Rationale: first change touching auth's security posture with a genuine migration (new table), 9 new files across all 4 hexagonal layers, a modification to the global `JwtAuthGuard` (defense-in-depth), a new custom class-validator constraint, AND full Strict TDD unit+e2e coverage (typically doubles LOC). No single work unit is small enough to keep this under 400 changed lines as one commit. This project ships via **work-unit commits straight to `dev`, never PRs** — "chaining" here means landing the 7 work units below as separate, independently verifiable commits in order, not GitHub PR chaining.

### Suggested Work Units

| Unit | Goal | Commit | Notes |
|------|------|--------|-------|
| 1 | Data layer: `RefreshToken` Prisma model + migration + entity + port + repository | Commit 1 | Foundation; nothing else lands until this is green |
| 2 | Env config: `REFRESH_JWT_SECRET`/`REFRESH_JWT_EXPIRES_IN` + `@IsDistinctFrom` validator + exported `JWT_DURATION_PATTERN` | Commit 2 | Independent of Unit 1; needed before Unit 3 signs anything |
| 3 | `AuthTokenIssuer` (replaces `buildAuthResponse`) + wire sign-up/sign-in | Commit 3 | Depends on Units 1+2 |
| 4 | `POST /auth/refresh` (rotate + reuse detection) | Commit 4 | Depends on Unit 3 |
| 5 | `POST /auth/logout` (idempotent revoke) | Commit 5 | Depends on Unit 1 (repository); independent of Unit 4 |
| 6 | `JwtAuthGuard` token-confusion defense-in-depth | Commit 6 | Depends on Unit 3's payload shape |
| 7 | E2E coverage + stale proposal.md line fix + final verification | Commit 7 | Depends on all prior units |

## Phase 1: Foundation — Data Layer (Commit 1)

- [x] 1.1 Add `RefreshToken` model to `prisma/schema.prisma` (`tokenHash @unique`, `userId`, `expiresAt`, `revokedAt`, `@@index([userId])`, `@@map("refresh_tokens")`) + `refreshTokens RefreshToken[]` back-relation on `User`
- [x] 1.2 Run `npx prisma generate` then `pnpm db:migrate` to create `prisma/migrations/<ts>_add_refresh_tokens/migration.sql`
- [x] 1.3 Create `refresh-token.entity.ts` (`RefreshTokenEntity extends BaseEntity`; fields `tokenHash`, `userId`, `expiresAt`, `revokedAt`)
- [x] 1.4 Create `refresh-token.repository.port.ts`: `RefreshTokenRepositoryPort` (`create`, `findByHash`, `revoke`, `revokeByHash`) + `REFRESH_TOKEN_REPOSITORY` Symbol
- [x] 1.5 RED: write `prisma-refresh-token.repository.spec.ts` — `create` persists hash+expiry; `findByHash` found/null; `revoke` sets `revokedAt=now`; `revokeByHash` idempotent no-op when row absent
- [x] 1.6 GREEN: implement `PrismaRefreshTokenRepository` satisfying 1.5

## Phase 2: Env Config (Commit 2)

- [x] 2.1 Export `JWT_DURATION_PATTERN` from `environment-variables.ts` (currently private)
- [x] 2.2 RED: write a spec for a new `IsDistinctFrom` custom class-validator constraint — passes when sibling values differ, fails when equal
- [x] 2.3 GREEN: implement `@ValidatorConstraint`-backed `@IsDistinctFrom(propertyName)` decorator (reads sibling via `ValidationArguments.object`)
- [x] 2.4 Add `REFRESH_JWT_SECRET` (`@IsString @IsNotEmpty @MinLength(32) @IsDistinctFrom('JWT_SECRET')`) and `REFRESH_JWT_EXPIRES_IN` (`@IsOptional @IsString @Matches(JWT_DURATION_PATTERN)`) to `EnvironmentVariables`
- [x] 2.5 RED+GREEN: extend `validate-env.spec.ts` (this repo's actual boot-validation spec file — `environment-variables.spec.ts` doesn't exist as a standalone file, `validateEnv()`/`validate-env.spec.ts` is where `JWT_SECRET`/`JWT_EXPIRES_IN` boot validation is already tested) — missing/short secret fails boot; malformed expiry fails boot; `REFRESH_JWT_SECRET === JWT_SECRET` fails boot; valid config with expiry omitted boots successfully (default `30d` applied at sign time, not at boot)

## Phase 3: AuthTokenIssuer + Sign-up/Sign-in Wiring (Commit 3)

- [x] 3.1 RED: write `auth-token-issuer.spec.ts` — issues access token (existing shape) + refresh token (`{ sub, type: 'refresh' }`, signed with `REFRESH_JWT_SECRET`, `expiresIn: REFRESH_JWT_EXPIRES_IN ?? '30d'`), persists hashed refresh row via repository
- [x] 3.2 GREEN: create injectable `AuthTokenIssuer` (`application/shared/auth-token-issuer.ts`), replacing `build-auth-response.ts`
- [x] 3.3 Update `SignUpUseCase`/`SignInUseCase` unit specs to assert `{ id, accessToken, refreshToken }` returned via `AuthTokenIssuer`
- [x] 3.4 GREEN: wire `SignUpUseCase`/`SignInUseCase` to use `AuthTokenIssuer`; delete `build-auth-response.ts`
- [x] 3.5 Register `AuthTokenIssuer` and `{ provide: REFRESH_TOKEN_REPOSITORY, useClass: PrismaRefreshTokenRepository }` in `auth.module.ts` providers (plus a `REFRESH_JWT_CONFIG` provider — required by the repo's pre-commit review gate to keep `process.env`/`normalizeJwtExpiry` out of the application layer; see apply-progress)

## Phase 4: Refresh Endpoint (Commit 4)

- [x] 4.1 Create `RefreshDto` (`{ @ApiProperty @IsString @IsNotEmpty refreshToken: string }`)
- [x] 4.2 RED: write `refresh-token.use-case.spec.ts` — valid token → revokes old, issues new pair; unknown/expired/malformed → 401; already-revoked (reuse) → 401, same shape, re-revoke is a no-op; payload with `type !== 'refresh'` → 401
- [x] 4.3 GREEN: implement `RefreshTokenUseCase` per design's Data Flow (verify → type check → hash lookup → reuse/expiry checks → revoke old → `AuthTokenIssuer.issue`)
- [x] 4.4 Add `@Public() @Post('refresh') @HttpCode(200)` handler to `AuthController` (no `@SkipThrottle`)

## Phase 5: Logout Endpoint (Commit 5)

- [x] 5.1 Create `LogoutDto` (`{ @ApiProperty @IsString @IsNotEmpty refreshToken: string }`)
- [x] 5.2 RED: write `logout.use-case.spec.ts` — valid token → revoked; already-revoked/unknown token → 200 no-op (idempotent)
- [x] 5.3 GREEN: implement `LogoutUseCase` (sha256 → `repository.revokeByHash`)
- [x] 5.4 Add `@Public() @Post('logout') @HttpCode(200)` handler to `AuthController`; register `RefreshTokenUseCase`/`LogoutUseCase` in `auth.module.ts`

## Phase 6: Guard Defense-in-Depth (Commit 6)

- [ ] 6.1 RED: write `jwt-auth.guard.spec.ts` case — a token that verifies successfully but has `payload.type === 'refresh'` is rejected with 401
- [ ] 6.2 GREEN: add minimal additive check in `JwtAuthGuard.canActivate` rejecting `payload.type === 'refresh'` immediately after signature verification (no new DB access; legitimate access tokens unaffected)

## Phase 7: E2E Coverage, Stale Doc Fix, Final Verification (Commit 7)

- [ ] 7.1 e2e: `POST /auth/refresh` with a valid token → 200, new access+refresh pair, old refresh token now returns 401
- [ ] 7.2 e2e: reusing an already-rotated/revoked refresh token → 401, identical shape to an unknown token
- [ ] 7.3 e2e: `POST /auth/logout` → 200; subsequent refresh with that token → 401; logout is idempotent (200 again on repeat)
- [ ] 7.4 e2e: `sign-up`/`sign-in` responses include `refreshToken` alongside `id`/`accessToken`
- [ ] 7.5 e2e: a refresh token presented as a Bearer access token on a protected route → 401 (proves Phase 6's guard check)
- [ ] 7.6 Update the stale `Success Criteria` line "Global `JwtAuthGuard` unchanged; refresh/logout are `@Public()`" in `openspec/changes/add-auth-refresh-token/proposal.md` — no longer accurate after Phase 6's justified minimal additive check; rewrite to cite the design's defense-in-depth decision so it doesn't read as a contradicted acceptance criterion at archive time
- [ ] 7.7 Run `pnpm typecheck && pnpm lint` — must be clean
- [ ] 7.8 Run `pnpm test` (unit) — all green
- [ ] 7.9 Run `pnpm test:e2e` against the docker-compose `db` service — all green, including 7.1-7.5
