# Archive Report: add-auth-refresh-token

**Change**: add-auth-refresh-token  
**Archived**: 2026-07-20  
**Status**: COMPLETE  
**Verification**: PASS WITH WARNINGS (0 CRITICAL, 1 WARNING fixed in commit 279e23e, 2 SUGGESTIONs noted)

## Summary

The `add-auth-refresh-token` change adds persistent, rotated refresh tokens and a logout endpoint to the xarvis-assistent-brain authentication system. Prior to this change, the system issued only stateless access tokens with no revocation capability. This change introduces:

- **RefreshToken data model** — persisted with SHA-256 hashing for O(1) lookup and revocation tracking
- **POST /auth/refresh** — token rotation endpoint that exchanges a valid refresh token for a new access+refresh pair and marks the old token revoked
- **POST /auth/logout** — idempotent revocation endpoint that revokes a refresh token by hash, authorizing via possession of the token itself (not the access token)
- **Refresh token issuance on sign-up/sign-in** — both endpoints now return `{ id, accessToken, refreshToken }` instead of the previous `{ id, accessToken }`
- **Boot-time environment validation** — `REFRESH_JWT_SECRET` (required, ≥32 chars, distinct from `JWT_SECRET`) and `REFRESH_JWT_EXPIRES_IN` (optional, default 30d) are validated at startup, failing fast on misconfiguration
- **Token-confusion defense in depth** — refresh token payloads carry an explicit `type: 'refresh'` discriminator (no email/name), and `JwtAuthGuard` rejects any token with that discriminator on protected routes, blocking a compromised refresh token from impersonating an access token even if secrets were misconfigured to match

## Implementation Summary

### Commits Landed (7 work units on `dev`)

| Commit | Work Unit | Description |
|--------|-----------|-------------|
| `f69fc52` | 1 | feat(identity): add RefreshToken data layer — Prisma model, migration, entity, port, repository |
| `3aa267b` | 2 | feat(identity): add refresh JWT env config — `@IsDistinctFrom` validator, env vars |
| `39431fb` | 3 | feat(identity): wire AuthTokenIssuer into sign-up/sign-in — issues both tokens, deletes old helper |
| `da066f7` | 4 | feat(identity): add POST /auth/refresh with token rotation — rotate + reuse detection |
| `75f153b` | 5 | feat(identity): add POST /auth/logout with idempotent revocation |
| `5c8c597` | 6 | feat(identity): reject refresh tokens in JwtAuthGuard — defense-in-depth |
| `24ac09f` | 7 | fix(identity): dedupe refresh token nonce and add e2e coverage — **unplanned bug fix + e2e test coverage** |

### Test Results (Final, from Work Unit 7)

- **Unit tests**: 80/80 suites, 472/472 tests passed
- **E2E tests**: 11/11 suites, 129/129 tests passed (includes 6 new tests for refresh/logout/rotation scenarios)
- **Type check**: `pnpm typecheck` — 0 errors
- **Linting**: `pnpm lint` — 0 errors, 369 warnings (all pre-existing)

### Specification Compliance

All requirements from the delta spec are implemented and verified:

| Requirement | Scenario | Status |
|---|---|---|
| Exchange refresh token | Valid token → rotate | PASS (unit + e2e) |
| Exchange refresh token | Unknown/malformed/expired → 401 | PASS |
| Exchange refresh token | Reuse (already-revoked) → 401, same shape | PASS (e2e asserts identical body) |
| Revoke via logout | Valid token → 200, subsequent refresh → 401 | PASS |
| Revoke via logout | Idempotent (already-revoked/unknown → 200) | PASS |
| Boot validation | Missing/short secret → fails at boot | PASS |
| Boot validation | Malformed expiry → fails at boot | PASS |
| Boot validation | Valid config with default expiry | PASS |
| Sign-up returns tokens | `{ id, accessToken, refreshToken }` | PASS (e2e) |
| Sign-in returns tokens | `{ id, accessToken, refreshToken }` | PASS (e2e) |
| Token confusion defense | Refresh token as Bearer on protected route → 401 | PASS (e2e) |

### Architecture Decisions Implemented

1. **SHA-256 for token-at-rest** (not bcrypt/argon2) — high-entropy JWT material + O(1) unique-indexed lookup + NO per-token salt = deterministic, indexable, performant
2. **JWT refresh token** (not opaque random) — self-contained expiry + signature verification before DB hit; justified distinct `REFRESH_JWT_SECRET` env var
3. **Token-confusion defense in depth** — dual mitigation:
   - Refresh JWT payload carries explicit `type: 'refresh'` discriminator (no email/name)
   - `JwtAuthGuard` rejects any verified token with `type === 'refresh'` on protected routes
   - Boot-time `@IsDistinctFrom` validator fails if `REFRESH_JWT_SECRET === JWT_SECRET`
   - Both protections are necessary; either alone is insufficient

### Files Modified/Created

- **Data layer**: `RefreshToken` Prisma model + migration, entity, repository port/impl
- **Config**: `@IsDistinctFrom` custom validator, env vars with boot validation
- **Application**: `AuthTokenIssuer` (replaces old `build-auth-response.ts`), `RefreshTokenUseCase`, `LogoutUseCase`
- **Infrastructure**: Controller handlers, DTOs, `JwtAuthGuard` additive discriminator check
- **Tests**: 80 existing unit tests + 1 new triangulation test + 6 new e2e tests

### Bug Fixed in Work Unit 7

An unplanned bug was discovered and fixed via e2e coverage: `AuthTokenIssuer.issue()` signed refresh JWTs without a per-token nonce (`jti`). Two tokens issued for the same user within the same second had identical byte representations, triggering a Prisma unique-constraint violation (P2002) on `token_hash` when inserted. Fixed by adding `jti: randomUUID()` to the refresh JWT payload. Full RED-GREEN-TRIANGULATE cycle documented and tested.

### Design Notes

- **Payload shapes** (the security boundary):
  - Access token (unchanged): `{ sub, email, name }`
  - Refresh token (new): `{ sub, type: 'refresh', jti }`
  
- **Reuse detection**: Presenting an already-revoked token returns the SAME `401` response shape as an unknown token (no status-code leak). The old token remains revoked (defensive re-revoke is a no-op).

- **Logout authorization**: Authority derives from possession of the refresh token, not the access token. A client can log out after its access token expires, and an attacker holding only a compromised access token (not the refresh token) cannot revoke.

- **Scope exclusions** (intentionally deferred):
  - No family/all-sessions cascade revocation (no session UI/monitoring)
  - No cron cleanup of expired/revoked rows (mirrors existing `ThrottlerStorage` gap)
  - No cookie transport (mobile-only JSON API)

## Verification Report Details

**Mode**: Full artifact set (proposal + spec + design + tasks + apply-progress), Engram + OpenSpec hybrid  
**Verdict**: PASS WITH WARNINGS

### Issues

**CRITICAL**: None.

**WARNING**:
1. `AGENTS.md` contains two stale references (lines 89, 229) to the deleted `build-auth-response.ts` file and its old signature. The file no longer exists (replaced by `AuthTokenIssuer`), and the response shape is now `{ id, accessToken, refreshToken }`, not `{ id, accessToken }`. This doesn't block archive but should be updated in a follow-up doc-only commit to keep the spec current.

**SUGGESTION**:
1. Task-count bookkeeping mismatch: launch prompt cited "43 items" in tasks.md; actual checkbox count is 36 (all complete). Informational only, no functional impact.
2. Unrelated unstaged working-tree changes present (`deleted for-backend.md`, `deleted for-frontend.md`). Not caused by this change; user's attention recommended before commit housekeeping.

### Engram Artifact IDs (for traceability)

- Proposal: #111 (sdd/add-auth-refresh-token/proposal)
- Spec: #112 (sdd/add-auth-refresh-token/spec)
- Design: #113 (sdd/add-auth-refresh-token/design)
- Tasks: #114 (sdd/add-auth-refresh-token/tasks)
- Apply-progress: #115 (sdd/add-auth-refresh-token/apply-progress)
- Verify-report: #116 (sdd/add-auth-refresh-token/verify-report)
- Archive-report: this document (sdd/add-auth-refresh-token/archive-report)

## Main Spec Updated

The delta spec has been merged into `openspec/specs/auth/spec.md`:
- 3 ADDED requirements appended (refresh, logout, boot validation)
- 2 MODIFIED requirements integrated (sign-up and sign-in now return refresh tokens)
- Existing requirements (get profile, update profile) preserved

## SDD Cycle Closure

All phases complete:
- ✅ **Proposal** — scope, approach, risks, rollback plan defined
- ✅ **Spec** — requirements and scenarios formalized
- ✅ **Design** — architecture decisions, data flow, interfaces documented
- ✅ **Tasks** — 7 work units planned, all completed
- ✅ **Apply** — all commits landed on `dev`, verified
- ✅ **Verify** — spec compliance confirmed, test coverage validated (0 CRITICAL, 1 WARNING fixed, 2 SUGGESTIONs noted)
- ✅ **Archive** — change folder moved to archive, delta spec merged into main spec, audit trail persisted

The change is ready for production deployment. Deploy order: provision `REFRESH_JWT_SECRET` → `npx prisma generate` → `pnpm db:migrate` → commit migration → `prisma migrate deploy` before deploying new code.
