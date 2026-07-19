# Design: Refresh Token + Logout Endpoints

## Technical Approach

Refresh tokens are **JWTs signed with a distinct `REFRESH_JWT_SECRET`** (self-contained expiry + signature → cheap pre-DB rejection of forged/expired tokens), while a persisted `refresh_tokens` row holds the **SHA-256 hash** of the JWT string plus rotation/revocation state. Signing/verifying reuse the existing global `JwtService` via per-call `{ secret, expiresIn, algorithm }` overrides — no second `JwtModule`. The existing `buildAuthResponse()` helper is promoted to an injectable `AuthTokenIssuer` service (still `application/shared/`) that issues access+refresh and persists the refresh row; `SignUp`, `SignIn`, and the new `RefreshToken` use case all consume it. Layout mirrors the existing `identity/auth` hexagonal module.

The refresh JWT carries a `type: 'refresh'` discriminator absent from the access-token `JwtPayload`, so the two token classes are structurally distinguishable **even if their secrets ever collide** (see "Decision: token-confusion defense in depth").

## Architecture Decisions

### Decision: SHA-256 for token-at-rest (not argon2/bcrypt)

| Option | Tradeoff | Decision |
|--------|----------|----------|
| argon2/bcrypt | Per-row random salt → cannot index → O(n) scan + N verifies per refresh; slow-hash buys nothing for high-entropy input | Rejected |
| **SHA-256** | Deterministic → single unique-indexed `WHERE token_hash = ?` lookup; preimage-resistant for high-entropy JWT | **Chosen** |

**Rationale**: The token material is a high-entropy JWT (128+ bits from the HMAC signature), not a low-entropy password. Slow hashing exists to defeat brute force of guessable inputs; it is pointless here and would break O(1) lookup on a value hashed on *every* refresh call. SHA-256 gives DB-leak protection (irreversible) with an indexable deterministic digest. Hash via `node:crypto` `createHash('sha256').update(token).digest('hex')`.

### Decision: JWT refresh token vs opaque random

**Chosen**: JWT signed with `REFRESH_JWT_SECRET`. Signature+expiry verification rejects forged/expired tokens *before* any DB hit; the row supplies revocation/rotation the stateless JWT can't. Justifies the proposal-mandated distinct secret + expiry env vars. Opaque-random rejected: would make those env vars meaningless.

### Decision: token-confusion defense in depth (revised — addresses gate-review CRITICAL)

**Threat**: `JwtAuthGuard.canActivate` (`src/infrastructure/guards/jwt-auth.guard.ts` line 39) verifies access tokens against the module-default `JWT_SECRET` with `algorithms: ['HS256']`, never touching the DB. If `REFRESH_JWT_SECRET` were ever misconfigured equal to `JWT_SECRET` (both today independently pass only `@MinLength(32)`), and the refresh JWT carried the same `{ sub, email, name }` shape as `JwtPayload`, a **leaked or rotated-away refresh token would validate as an access token against every protected route for up to 30 days** — the stateless guard cannot know the refresh row was revoked. This silently defeats the entire revocation model. The previous "distinctness is operational-only, not code-enforced" stance is therefore rejected.

Both mitigations below ship together (defense in depth); either alone is insufficient.

| Layer | Mechanism | What it blocks |
|-------|-----------|----------------|
| **Payload discriminator** | Refresh JWT payload is `{ sub, type: 'refresh' }` — no `email`/`name`, plus an explicit `type` claim the access token never carries. `JwtAuthGuard` rejects (`401`) any verified token whose `payload.type === 'refresh'`. `RefreshTokenUseCase`/`LogoutUseCase` conversely reject any presented token whose `type !== 'refresh'`. | A refresh token presented as an access token (and vice-versa) — holds **even if the two secrets collide**, since the check is on payload shape, not signature. |
| **Boot-time distinctness** | A class-validator custom constraint on `REFRESH_JWT_SECRET` (same decorator style as the existing `@MinLength`/`@Matches` in `environment-variables.ts`) fails `validateSync` at boot when `REFRESH_JWT_SECRET === JWT_SECRET`. | The misconfiguration ever reaching runtime — fail fast, not fail silent. |

**Choice**: custom class-validator constraint (a `@ValidatorConstraint`-backed `@IsDistinctFrom('JWT_SECRET')` decorator reading the sibling via `ValidationArguments.object`), NOT a hand-rolled `main.ts` assertion — this matches the file's existing convention where every env invariant is a property decorator validated through the same `validateSync` path already covered by the spec's boot-validation scenarios.

**Note on guard change**: the proposal said "global `JwtAuthGuard` unchanged". This design deliberately deviates with a **minimal additive** rejection check (one `if (payload.type === 'refresh') throw`) — no DB access added, no behavior change for legitimate access tokens. The deviation is justified by the CRITICAL finding above.

## Data Flow

    POST /auth/refresh ─→ RefreshTokenUseCase
      verify JWT(secret=REFRESH_JWT_SECRET) ──fail──→ 401
      payload.type !== 'refresh' ──→ 401
      sha256 ─→ repo.findByHash ──null──→ 401
      revokedAt set ─→ re-revoke (no-op) ─→ 401   (reuse detection, same shape)
      valid ─→ revoke old ─→ AuthTokenIssuer.issue(user) ─→ 200 {id,accessToken,refreshToken}

    POST /auth/logout ─→ LogoutUseCase: sha256 ─→ repo.revokeByHash (idempotent) ─→ 200

    Any protected route ─→ JwtAuthGuard: verify(JWT_SECRET) ─→ payload.type === 'refresh' ──→ 401

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modify | Add `RefreshToken` model + `refreshTokens RefreshToken[]` back-relation on `User` |
| `prisma/migrations/<ts>_add_refresh_tokens/migration.sql` | Create | Generated CREATE TABLE (see Migration) |
| `.../auth/domain/entities/refresh-token.entity.ts` | Create | `RefreshTokenEntity extends BaseEntity` |
| `.../auth/domain/ports/refresh-token.repository.port.ts` | Create | Port + `REFRESH_TOKEN_REPOSITORY` Symbol |
| `.../auth/infrastructure/repositories/prisma-refresh-token.repository.ts` | Create | Prisma adapter |
| `.../auth/application/shared/auth-token-issuer.ts` | Create | Injectable; replaces `build-auth-response.ts` (issues+persists both tokens; refresh payload `{ sub, type: 'refresh' }`) |
| `.../auth/application/use-cases/refresh-token.use-case.ts` | Create | Rotate; rejects non-`refresh` payloads |
| `.../auth/application/use-cases/logout.use-case.ts` | Create | Idempotent revoke |
| `.../auth/infrastructure/dto/refresh.dto.ts`, `logout.dto.ts` | Create | `{ refreshToken }` — with `@ApiProperty` (see Interfaces) |
| `.../auth/infrastructure/controllers/auth.controller.ts` | Modify | `@Public @Post('refresh'|'logout')`, `@HttpCode(200)`, no `@SkipThrottle` |
| `.../auth/auth.module.ts` | Modify | Wire `REFRESH_TOKEN_REPOSITORY`, new use cases, `AuthTokenIssuer` |
| `.../auth/application/use-cases/sign-up|sign-in.use-case.ts` | Modify | Use `AuthTokenIssuer` → return `{id,accessToken,refreshToken}` |
| `src/infrastructure/guards/jwt-auth.guard.ts` | Modify | Reject `payload.type === 'refresh'` after verify (see defense-in-depth decision) |
| `src/infrastructure/config/env/environment-variables.ts` | Modify | Add `REFRESH_JWT_SECRET` (+ `@IsDistinctFrom('JWT_SECRET')`), `REFRESH_JWT_EXPIRES_IN`; export & reuse `JWT_DURATION_PATTERN` |

## Interfaces / Contracts

```prisma
model RefreshToken {
  id        String    @id @default(uuid())
  tokenHash String    @unique @map("token_hash")   // sha256 hex → O(1) unique lookup
  userId    String    @map("user_id")
  expiresAt DateTime  @map("expires_at")
  revokedAt DateTime? @map("revoked_at")
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])                                  // cleanup queries (cron out of scope)
  @@map("refresh_tokens")
}
```

```ts
export interface RefreshTokenRepositoryPort {
  create(entity: RefreshTokenEntity): Promise<void>;
  findByHash(tokenHash: string): Promise<RefreshTokenEntity | null>;
  revoke(entity: RefreshTokenEntity): Promise<void>;      // sets revokedAt=now (rotation)
  revokeByHash(tokenHash: string): Promise<void>;         // idempotent, no-op if absent
}
export const REFRESH_TOKEN_REPOSITORY = Symbol('RefreshTokenRepositoryPort');
```

Token payload shapes — the discriminator is the security boundary:
```ts
// access token (unchanged, JwtAuthGuard's JwtPayload) — carries user profile
{ sub: string; email: string; name: string }
// refresh token (new) — deliberately NO email/name, explicit type claim
type RefreshJwtPayload = { sub: string; type: 'refresh' };
```

Sign/verify (per-call overrides, no second JwtModule):
```ts
// issue (AuthTokenIssuer): sign refresh with distinct secret + type claim
jwtService.signAsync({ sub: user.id, type: 'refresh' },
  { secret: REFRESH_JWT_SECRET, expiresIn: REFRESH_JWT_EXPIRES_IN ?? '30d', algorithm: 'HS256' });
// verify (RefreshTokenUseCase): distinct secret; then assert payload.type === 'refresh'
jwtService.verifyAsync<RefreshJwtPayload>(token,
  { secret: REFRESH_JWT_SECRET, algorithms: ['HS256'] });
```

DTOs (`whitelist: true` strips extras; `@ApiProperty` for Swagger, consistent with `sign-in.dto.ts`):
```ts
class RefreshDto { @ApiProperty() @IsString() @IsNotEmpty() refreshToken: string; }
class LogoutDto  { @ApiProperty() @IsString() @IsNotEmpty() refreshToken: string; }
```

Env — `JWT_DURATION_PATTERN` (currently a private non-exported const in `environment-variables.ts`) is **exported and reused** by `REFRESH_JWT_EXPIRES_IN`, not duplicated, so both fields share one regex source of truth:
```ts
export const JWT_DURATION_PATTERN = /.../;              // was private — now exported
@IsString() @IsNotEmpty() @MinLength(32)
@IsDistinctFrom('JWT_SECRET')                           // custom constraint, fails at boot on collision
REFRESH_JWT_SECRET: string;
@IsOptional() @IsString() @Matches(JWT_DURATION_PATTERN) REFRESH_JWT_EXPIRES_IN?: string; // default '30d' at sign time
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | RefreshTokenUseCase (valid/unknown/expired/reuse + rejects non-`refresh` payload), LogoutUseCase idempotency, AuthTokenIssuer, SHA-256 helper | Mock repo + JwtService |
| Unit | JwtAuthGuard rejects a `type: 'refresh'` token with 401 | Mock JwtService returning refresh-shaped payload |
| Unit | env validation fails on missing/short secret, malformed expiry, **and `REFRESH_JWT_SECRET === JWT_SECRET`** | `validateSync` |
| E2E | refresh rotates + old→401; reuse→401 same shape; logout→200 then refresh→401; sign-up/sign-in return refreshToken; **refresh token used as Bearer on a protected route → 401** | Real Prisma per AGENTS.md |

## Migration / Rollout

Additive, backward-compatible (old code ignores the new table). **Deploy order**: (1) provision `REFRESH_JWT_SECRET` (distinct from `JWT_SECRET`, else boot fails fast) everywhere; (2) `npx prisma generate`; (3) `pnpm db:migrate` locally → commit migration; (4) `prisma migrate deploy` **before** deploying new code.

**Up** (generated): `CREATE TABLE "refresh_tokens" (...)`, `CREATE UNIQUE INDEX "refresh_tokens_token_hash_key"`, `CREATE INDEX "refresh_tokens_user_id_idx"`, FK to `users` `ON DELETE CASCADE`.

**Down (rollback)**:
```sql
DROP TABLE "refresh_tokens";
```
Rollback order: revert the feature commit first (new code stops touching the table, sign-up/sign-in back to `{id,accessToken}`), then `DROP TABLE`. The `users` table has **no new column** (the back-relation is virtual) — only the new table is created/dropped, so zero side effects on existing `User` data.

## Open Questions

None.
