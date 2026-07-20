# Proposal: Default User Template at Sign-Up

## Intent

`SignUpUseCase` creates only the `User` row — a new user lands with zero Accounts, Categories, and Groups and must build everything by hand before the app is usable. Separately, `Category.userId` is nullable to support "global" shared categories (`userId: null` rows seeded once, visible to all via `OR: [{ userId }, { userId: null }]`). This split is inconsistent (`Account`/`Group` are already per-user, required, strictly scoped) and forces hand-rolled null-handling in `prisma-category.repository.ts`. Retire the global-category concept: every new user gets their OWN editable copies of a default Account/Category/Group set at sign-up.

## Scope

### In Scope
- Provision defaults for each new user in `SignUpUseCase` (or a wired-after step), scoped to the new `userId`.
- Default set: 15 categories (verbatim from `DEFAULT_CATEGORIES`), 3 accounts (`Principal` AT02 `isPrincipal:true`, `Ahorro` AT04, `Efectivo` AT01), 2 groups (`Casa`, `Gastos Hormigas`).
- Migration: `Category.userId` `String?` → `String` (required), preserving `@@unique([name, movementType, userId])`.
- Drop the `OR: [{ userId }, { userId: null }]` clause from `findAll`/`findById`; remove the now-dead null-handling upsert workaround.
- Production backfill: create the default set for every EXISTING user; safely retire global rows and preserve Movement→category integrity.

### Out of Scope
- `Exercise` global-catalog (`userId: null`) pattern — separate domain, untouched.
- Reworking `AT03`/Crédito flow (no default account uses it).
- Changing `delete-account.ts` principal-guard behavior.
- Final `isCustom` keep-or-remove decision (deferred to design).

## Capabilities

### New Capabilities
- `user-default-template`: rules for the default Account/Category/Group set provisioned per user at sign-up and its production backfill.

### Modified Capabilities
- `auth`: sign-up now provisions the default template as part of user creation.

## Approach

Batch-create defaults through the domain layer (not raw SQL), reusing repository ports; set `isPrincipal:true` explicitly on `Principal` (do NOT reuse `CreateAccountUseCase`'s `accountCount===0` auto-principal inference in a batch). No `creditLimitCents` (no AT03) and no `budgetCents` (informational). Backfill via an idempotent `tsx` script mirroring `seed.ts`'s upsert spirit. Design must decide global-row retirement order given `Movement.category` FK is `onDelete: Restrict`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `.../auth/application/use-cases/sign-up.use-case.ts` | Modified | Provision defaults post user-create |
| `prisma/schema.prisma` | Modified | `Category.userId` → required |
| `.../category/infrastructure/repositories/prisma-category.repository.ts` | Modified | Drop `userId:null` clause + workaround |
| `.../category/.../get-all-categories.use-case.ts` | Modified | `isCustom` always-true — design decides fate |
| `prisma/seed.ts` | Modified | Categories become per-user, not global |
| backfill script (new) | New | Idempotent existing-user backfill |
| `test/**`, `**/*.spec.ts` | New | Unit + e2e (Strict TDD) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Deleting global category still referenced by a Movement | High | FK is `onDelete: Restrict`; design must reassign Movements (name+movementType match) to user's own copy BEFORE deleting global rows |
| Non-idempotent backfill duplicates defaults | Med | Upsert on `(name, movementType, userId)` / `(name, userId)`; re-runnable |
| `userId`-required migration fails on existing null rows | High | Backfill + reassignment must precede the NOT NULL migration |
| `isCustom` removal breaks frontend contract | Med | Design checks actual frontend usage before deciding |
| Partial sign-up (user created, defaults fail) | Med | Provision inside the same transaction/flow as user create |

## Rollback Plan

Feature commit revert restores hand-built sign-up. The `Category.userId` migration needs an explicit down migration (`String` → `String?`); safe because no rows lose data (all users keep their own copies). Backfilled rows are user-owned and harmless if left in place — do NOT reintroduce global `userId:null` rows on rollback. Design specifies the down migration.

## Dependencies

- `npx prisma generate` + `pnpm db:migrate`; `prisma migrate deploy` + backfill script run manually pre/at deploy (Dokploy — migrations never auto-run).
- Backfill + Movement reassignment MUST run before the NOT NULL migration in production.

## Success Criteria

- [ ] New sign-up yields 3 accounts, 15 categories, 2 groups owned by that user.
- [ ] `Principal` is the only `isPrincipal:true` account.
- [ ] `Category.userId` is non-null; no `userId:null` category rows remain in production.
- [ ] Category `findAll`/`findById` no longer query `userId:null`; workaround removed.
- [ ] Every pre-existing user has the default set; their Movements keep valid category references.
- [ ] `Exercise` global rows untouched.
- [ ] Unit + e2e green under Strict TDD.
