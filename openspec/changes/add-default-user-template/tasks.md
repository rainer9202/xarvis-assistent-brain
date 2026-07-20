# Tasks: Default User Template at Sign-Up

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1300-1600 (2 new domain/infra files for TransactionRunner; 4 repositories modified for `tx?`; 3 new domain-constant files; 3 new provisioning use cases + specs; 1 new composer; sign-up + auth.module wiring; schema migration; backfill script + dry-run check; get-all-categories cleanup; category repository cleanup; unit + e2e specs across all of the above) |
| 400-line budget risk | High |
| Chained work-unit commits recommended | Yes |
| Suggested split | 6 ordered work-unit commits (see below) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending — orchestrator must confirm chain strategy before apply |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

Rationale: this change crosses a new cross-cutting primitive (`TransactionRunner`), 4 repositories, 3 money-manager modules' provisioning use cases plus their composer, a NOT-NULL schema migration gated on a production data-repair script, and full Strict TDD unit+e2e coverage. No single commit safely holds all of this under 400 changed lines. Work units below are ordered so each is independently testable and revertible; the schema-migration unit (5) is explicitly NOT a normal CI-deployed step — it carries a manual production gate.

### Suggested Work Units

| Unit | Goal | Commit | Notes |
|------|------|--------|-------|
| 1 | `TransactionRunner` port + `PrismaTransactionRunner` + `tx?` threading into `User`/`Account`/`Category`/`Group` repositories | Commit 1 | Foundation; nothing else lands until green |
| 2 | Default-template constants + per-module `ProvisionDefault*UseCase` (Account/Category/Group) | Commit 2 | Depends on Unit 1's repository `tx?` signatures |
| 3 | `DefaultUserDataProvisioner` + `SignUpUseCase`/`auth.module.ts` wiring (transactional sign-up) | Commit 3 | Depends on Unit 2 |
| 4 | `isCustom` removal + category repository `userId:null` cleanup | Commit 4 | Independent of 1-3; can land any time after spec is settled |
| 5 | Prisma schema migration (`Category.userId` NOT NULL) — production-gated, NOT auto-deployed | Commit 5 | Depends on Unit 6's backfill script having run and verified in production FIRST; this commit only ships the migration file, not its production execution |
| 6 | Backfill script `prisma/scripts/provision-default-user-data.ts` + dry-run/verification check + e2e sign-up coverage | Commit 6 | Depends on Units 2-4; must be run and verified in production BEFORE Unit 5's migration is deployed |

## Phase 1: TransactionRunner Foundation (Commit 1)

- [x] 1.1 RED: write `transaction-runner.port.spec.ts` style contract test is not applicable (pure interface) — instead write `prisma-transaction-runner.spec.ts` asserting `run()` invokes `this.prisma.$transaction(fn)` and returns its resolved value, and that a thrown error inside `work` propagates (rollback contract)
- [x] 1.2 GREEN: create `src/domain/ports/transaction-runner.port.ts` (`TransactionRunner.run<T>(work)`, opaque `TransactionContext = unknown`) and `PrismaTransactionRunner` (infra) implementing it via `this.prisma.$transaction(async (client) => work(client))`
- [x] 1.3 Register `{ provide: TRANSACTION_RUNNER, useClass: PrismaTransactionRunner }` in the appropriate shared/global module (`PrismaModule`, since it's `@Global()`)
- [x] 1.4 RED: extend `prisma-user.repository.spec.ts` — `create(entity, tx)` uses the passed `tx` client instead of `this.prisma` when provided; existing no-arg call still uses `this.prisma`
- [x] 1.5 GREEN: add optional `tx?: TransactionContext` param to `UserRepositoryPort.create`/`PrismaUserRepository.create`, resolved via `const db = (tx as Prisma.TransactionClient) ?? this.prisma`
- [x] 1.6 RED: extend `prisma-account.repository.spec.ts` — `save(entity, tx)` uses the resolved `db` handle in BOTH the primary `create()` call AND the existing P2002 catch-and-retry `create()` call
- [x] 1.7 GREEN: add optional `tx?: TransactionContext` to `AccountRepositoryPort.save`/`PrismaAccountRepository.save`; resolve `db` once at the top of `save()` and use it in both the try-block and the catch-block retry create
- [x] 1.8 RED: extend `prisma-category.repository.spec.ts` — `save(entity, tx)` uses the resolved `db` handle
- [x] 1.9 GREEN: add optional `tx?: TransactionContext` to `CategoryRepositoryPort.save`/`PrismaCategoryRepository.save`
- [x] 1.10 RED: extend `prisma-group.repository.spec.ts` — `save`/`create` (mirror Group's actual write method name) uses the resolved `db` handle
- [x] 1.11 GREEN: add optional `tx?: TransactionContext` to `GroupRepositoryPort`'s write method / `PrismaGroupRepository`
- [x] 1.12 Run `pnpm test` for all 4 modified repository spec files — confirm no existing (no-`tx`) call sites broke

## Phase 2: Default Templates + Per-Module Provisioning Use Cases (Commit 2)

- [x] 2.1 Create `src/modules/money-manager/account/domain/default-accounts.ts` — in-code constants: `Principal` (`AT02`, `isPrincipal:true`), `Ahorro` (`AT04`), `Efectivo` (`AT01`), no `creditLimitCents`
- [x] 2.2 Create `src/modules/money-manager/category/domain/default-categories.ts` — re-export/relocate the existing 15 `DEFAULT_CATEGORIES` from `prisma/seed.ts` so both seed and provisioning import the single shared constant
- [x] 2.3 Create `src/modules/money-manager/group/domain/default-groups.ts` — `Casa`, `Gastos Hormigas`, no `budgetCents`
- [x] 2.4 RED: write `provision-default-accounts.use-case.spec.ts` — given a `userId`, creates exactly 3 accounts via the port, `Principal` explicitly `isPrincipal:true` (not the `accountCount===0` inference), passes `tx` through to `repository.save`
- [x] 2.5 GREEN: implement `ProvisionDefaultAccountsUseCase` in `account/application/use-cases/`, exported from `AccountModule`
- [x] 2.6 RED: write `provision-default-categories.use-case.spec.ts` — creates exactly 15 categories from the shared constant, each `userId`-owned, `tx` passed through
- [x] 2.7 GREEN: implement `ProvisionDefaultCategoriesUseCase` in `category/application/use-cases/`, exported from `CategoryModule`
- [x] 2.8 RED: write `provision-default-groups.use-case.spec.ts` — creates exactly 2 groups, no `budgetCents`, `tx` passed through
- [x] 2.9 GREEN: implement `ProvisionDefaultGroupsUseCase` in `group/application/use-cases/`, exported from `GroupModule`

## Phase 3: Provisioner + Transactional Sign-Up Wiring (Commit 3)

- [x] 3.1 RED: write `default-user-data-provisioner.spec.ts` — `provision(userId, tx)` calls all 3 `ProvisionDefault*UseCase`s with the same `userId`/`tx`; a failure in any one propagates (no swallowing)
- [x] 3.2 GREEN: implement `DefaultUserDataProvisioner` in `identity/auth/application/shared/default-user-data-provisioner.ts`
- [x] 3.3 Update `auth.module.ts` — import `AccountModule`/`CategoryModule`/`GroupModule`, register `DefaultUserDataProvisioner`
- [x] 3.4 RED: extend `sign-up.use-case.spec.ts` — successful sign-up calls `TransactionRunner.run()` wrapping `userRepo.create(entity, tx)` + `provisioner.provision(userId, tx)`; a provisioning failure rejects the whole sign-up (no `User` row persisted — assert `run()`'s callback throwing propagates, not caught)
- [x] 3.5 GREEN: wire `SignUpUseCase` to inject `TransactionRunner` and `DefaultUserDataProvisioner`, wrap both writes in one `run()` call
- [x] 3.6 Run `pnpm test` for `sign-up.use-case.spec.ts` and all Phase 2 specs together — confirm green

## Phase 4: isCustom Removal + Category Query Cleanup (Commit 4)

- [ ] 4.1 RED: update `get-all-categories.use-case.spec.ts` — response objects no longer contain an `isCustom` key
- [ ] 4.2 GREEN: remove `isCustom` field from `GetAllCategoriesResponse` and its `item.userId !== null` derivation in `GetAllCategoriesUseCase`
- [ ] 4.3 RED: update `prisma-category.repository.spec.ts` — `findAll`/`findById` query only `{ userId }`, never `OR: [{ userId }, { userId: null }]`
- [ ] 4.4 GREEN: drop the `OR` clause from `findAll`/`findById` in `prisma-category.repository.ts`
- [ ] 4.5 Run `pnpm test --testPathPatterns=category` — confirm green

## Phase 5: Schema Migration — Category.userId NOT NULL (Commit 5, production-gated)

- [ ] 5.1 Update `prisma/schema.prisma` — `Category.userId` from `String?` to `String`; keep `@@unique([name, movementType, userId])`
- [ ] 5.2 Run `npx prisma generate` then `pnpm db:migrate` locally (dev DB only) to produce `prisma/migrations/<ts>_category_user_id_required/migration.sql` (NOT NULL + drop the partial global-unique index) with its down migration (`DROP NOT NULL` + recreate partial index)
- [ ] 5.3 **MANUAL PRODUCTION GATE — do not automate**: this migration MUST NOT be applied to production (`prisma migrate deploy`) until Phase 6's backfill script has run against production AND Phase 6's verification step confirms zero `userId: null` category rows and zero orphaned Movement references remain. Document this gate explicitly in the PR description; CI/deploy must not auto-run `prisma migrate deploy` for this migration.
- [ ] 5.4 Update `prisma/seed.ts` to consume the shared `default-categories.ts` constant and stop relying on nullable `userId` upsert semantics

## Phase 6: Backfill Script + Verification + E2E Coverage (Commit 6)

- [ ] 6.1 RED: write a test harness (integration, real Prisma against docker-compose `db`) seeding: one existing user with zero accounts/categories/groups, one existing user with Movements referencing a global (`userId:null`) default category, and one existing user with a Movement referencing a global NON-default category (edge case)
- [ ] 6.2 GREEN: implement `prisma/scripts/provision-default-user-data.ts` — per user: `upsert` own copies of the 3 default accounts/15 categories/2 groups on `(name, movementType, userId)`/equivalent natural keys; for every global category referenced by a Movement, ensure the user has an owned copy (creating a non-default one if needed, reusing that global row's own `icon` verbatim); reassign those `Movement.categoryId` to the owned copy; finally delete now-unreferenced global (`userId:null`) rows
- [ ] 6.3 Assert against the Phase 6.1 harness: idempotent (running twice produces no duplicates), the zero-accounts user ends up with exactly the default set, the default-global Movement is reassigned to the user's owned default copy, and the non-default-global Movement is reassigned to a newly-created owned copy carrying the original icon
- [ ] 6.4 GREEN: implement the companion dry-run/verification check (read-only script or exported function) confirming `SELECT count(*) FROM categories WHERE user_id IS NULL` = 0 and no `Movement` references an absent/global category — this is the gate Phase 5.3 depends on
- [ ] 6.5 e2e: `POST /auth/sign-up` — new user ends up owning exactly 3 accounts (`Principal`/`AT02`/`isPrincipal:true`, `Ahorro`/`AT04`, `Efectivo`/`AT01`), 15 categories, 2 groups (`Casa`, `Gastos Hormigas`); `Principal` is the only `isPrincipal:true` account
- [ ] 6.6 e2e: a provisioning failure (simulate via a forced repository error) leaves no `User` row behind — sign-up returns an error and a retry with the same email succeeds (proves rollback, not the rejected compensating-delete lockout)
- [ ] 6.7 Run `pnpm typecheck && pnpm lint` — must be clean
- [ ] 6.8 Run `pnpm test` (unit) — all green
- [ ] 6.9 Run `pnpm test:e2e` against the docker-compose `db` service (`docker compose up -d db` first) — all green, including 6.5-6.6
