# Design: Default User Template at Sign-Up

## Technical Approach

Every user owns their editable copies of a default Account/Category/Group set; the global-category concept (`userId: null`) is retired. Two workstreams: (1) a **runtime provisioner** wired into sign-up for new users, (2) an **idempotent one-off backfill script** for existing users. The schema break (`Category.userId` → NOT NULL) is deliberately the LAST production step, gated on the backfill having removed every `userId: null` row and reassigned every referencing Movement — because `Movement.category` is `onDelete: Restrict` (schema.prisma:119) and the column cannot be made NOT NULL while null rows exist. Templates become plain in-code constants (same shape as `DEFAULT_CATEGORIES` in `prisma/seed.ts`), each owned by its money-manager module and shared by seed, backfill, and provisioner.

## Architecture Decisions

### Decision: Staged rollout — data first, schema last (the crux)

| Option | Tradeoff | Decision |
|--------|----------|----------|
| One migration doing schema + data together | SQL data-backfill with per-user matching/reassignment is unmaintainable; NOT NULL + FK-restricted delete in one shot is unrecoverable if a single referencing Movement is missed | Rejected |
| **Staged: script backfill → verify → NOT NULL migration → deploy code** | More manual steps, brief cosmetic duplicate window | **Chosen** |

**Rationale**: The destructive/complex data work is verified independently BEFORE the near-irreversible schema flip. Ordered production pipeline (Dokploy, all manual):
1. Run backfill script: for every user, upsert own copies of defaults; for every **global category referenced by a Movement**, ensure the owning user has an own copy of *that* category (by `name`+`movementType`, creating even non-default ones) and reassign those `Movement.categoryId`; then delete all now-unreferenced global rows. Idempotent, re-runnable.
2. Verify: `SELECT count(*) FROM categories WHERE user_id IS NULL` = 0; no orphan movements.
3. `prisma migrate deploy` — `Category.userId` NOT NULL + drop partial index `categories_name_movement_type_global_unique`.
4. Deploy feature code (provisioning + own-only reads + workaround removed). New signups between steps 1–4 use old code (no provisioning); re-run the idempotent script once post-deploy to catch them.

### Decision: Backfill in a tsx script, not migration SQL

**Choice**: `prisma/scripts/provision-default-user-data.ts`, run `DATABASE_URL=<prod> npx tsx prisma/scripts/...` (mirrors `seed.ts`; new `scripts/` dir keeps it distinct from seed). **Rejected**: raw SQL in a Prisma migration — per-user branching, natural-key matching, and Movement reassignment need real application logic; migrations stay schema-only. Idempotency via `prisma.category.upsert()` on `name_movementType_userId` (works now, since backfilled rows carry a real non-null `userId`). When the owned copy is created for a **non-default** global (one not among the 15 templates — migration `20260713172727` set ALL then-existing categories to `userId: null`, not just the 15), the new owned row reuses **that global row's own existing `icon` value verbatim** — never a placeholder and never an unrelated default category's icon.

### Decision: Provisioning wiring + failure semantics

**Choice**: `DefaultUserDataProvisioner` in `identity/auth/application/shared/` (mirrors `AuthTokenIssuer`). It imports `AccountModule`/`CategoryModule`/`GroupModule` and injects one **exported** `ProvisionDefault{Accounts,Categories,Groups}UseCase` per module (honors AGENTS.md "modules export only use cases"; each provisioning use case injects its OWN module's port — application→domain only). Accounts set `isPrincipal: true` explicitly on `Principal` (NOT the `accountCount===0` inference in `CreateAccountUseCase`). Sign-up is **transactional/all-or-nothing**: `SignUpUseCase` runs user-create + provisioning inside one unit of work; any failure aborts sign-up.

| Failure option | Tradeoff | Decision |
|----------------|----------|----------|
| Best-effort / fire-and-forget | User lands half-provisioned, silent inconsistency | Rejected |
| Compensating delete of the user on failure (`User onDelete: Cascade`) | No new primitive, BUT if the compensating delete itself fails after a partial provision, the orphaned `User` row survives with zero accounts/categories/groups; sign-up returns an error yet `SignUpUseCase`'s `findByEmail` check now **permanently** blocks any retry (`ConflictException: Email "..." is already registered`), locking that email out. Production dead-end. | Rejected |
| **Transactional — a single shared `TransactionRunner` port over Prisma `$transaction`** | New cross-cutting primitive; provisioning write methods take an optional `tx` handle | **Chosen (definitive — no fallback)** |

**Rationale**: A user with 3 accounts but missing categories is a broken first-run; atomicity with the `User` row is the invariant. An interactive `$transaction` has **no partial window** — either every insert commits or Postgres rolls all of them back, so there is never an orphaned `User` to compensate for. The compensating-delete alternative is rejected outright (not kept as a fallback) precisely because its own failure mode is the permanent-lockout dead-end above: rollback avoids it by construction.

**How `TransactionRunner` works here (concrete)**: `PrismaService` already `extends PrismaClient` and builds the `@prisma/adapter-pg` adapter in its constructor (AGENTS.md "Database"), so `this.$transaction(fn)` is available directly — no extra wiring. The port `TransactionRunner.run<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T>` is implemented by `PrismaTransactionRunner`, which calls `this.prisma.$transaction(async (client) => work(client))`. `TransactionContext` is an **opaque domain-owned type** (aliased to `unknown` in the port file) so no Prisma type leaks into `domain`/`application` and the enforced dependency rule stays intact. Each Prisma repository unwraps it only at the infra boundary: `const db = (tx as Prisma.TransactionClient) ?? this.prisma;` then uses `db.account.create(...)`. `SignUpUseCase` wraps `userRepo.create(user, tx)` + `DefaultUserDataProvisioner.provision(userId, tx)` in one `run()`; any throw rolls back the whole unit (User + 3 Accounts + 15 Categories + 2 Groups).

**Backward compatibility (confirmed)**: the added `tx?: TransactionContext` is an **optional trailing param** on the affected write methods of the `User` (`create`), `Account` (`save`), `Category`, and `Group` repository ports, resolved via `(tx as Prisma.TransactionClient) ?? this.prisma`. Every existing non-feature call site (`CreateAccountUseCase`, `CreateCategoryUseCase`, `CreateGroupUseCase`, etc.) passes nothing and keeps using `this.prisma` unchanged — this signature change touches **no** call site outside this feature.

### Decision: Remove `isCustom` (evidence-based)

**Choice**: Remove `isCustom` from `GetAllCategoriesResponse`. **Rationale**: The money-manager frontend's `Category` type (`lib/api/categories.ts`) does not declare `isCustom`, and `categories-view.tsx` never branches on it — it is unconsumed. Post-migration it is always `true` (dead weight). No frontend contract breaks. **Rejected**: keeping an always-true field.

### Decision: NOT NULL migration + upsert cleanup

Migration drops NOT NULL nullable and the partial global-unique index; the compound `@@unique([name, movementType, userId])` now fully enforces per-user uniqueness with no null case. This unlocks replacing the hand-rolled find-then-create in `prisma-category.repository.ts`/`seed.ts` with real `prisma.category.upsert()` — noted as a **cleanup opportunity, not mandatory scope**.

## Data Flow

    Sign-up:  POST /auth/sign-up ─→ SignUpUseCase
              TransactionRunner.run(tx):
                userRepo.create(user, tx)
                DefaultUserDataProvisioner.provision(userId, tx)
                  ├─ ProvisionDefaultAccounts  (Principal isPrincipal:true, Ahorro, Efectivo)
                  ├─ ProvisionDefaultCategories (15 defaults)
                  └─ ProvisionDefaultGroups     (Casa, Gastos Hormigas)
              any throw → rollback → sign-up fails

    Backfill: per user → upsert own defaults → reassign global-referenced Movements
              → delete global (userId:null) rows → verify 0 remain → NOT NULL migration

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `.../auth/application/shared/default-user-data-provisioner.ts` | Create | Orchestrates provisioning inside a tx |
| `.../auth/application/use-cases/sign-up.use-case.ts` | Modify | Wrap create+provision in TransactionRunner |
| `.../auth/auth.module.ts` | Modify | Import 3 money-manager modules; wire provisioner |
| `.../{account,category,group}/application/use-cases/provision-default-*.use-case.ts` | Create | Exported per-module batch provisioners (accept `userId`, `tx`) |
| `.../{account,category,group}/domain/default-*.ts` | Create | In-code template constants (shared by seed/backfill/provisioner) |
| `src/domain/ports/transaction-runner.port.ts` | Create | `run<T>(work)` port + opaque `TransactionContext` (aliased `unknown`, keeps Prisma out of domain) |
| `.../infrastructure/.../prisma-transaction-runner.ts` | Create | Implements the port via `this.prisma.$transaction(async (client) => work(client))` |
| `.../{user,account,category,group}/.../prisma-*.repository.ts` | Modify | Write methods accept optional `tx`; resolve `(tx as Prisma.TransactionClient) ?? this.prisma` (backward compatible) |
| `.../category/.../prisma-category.repository.ts` | Modify | Drop `OR:[{userId},{userId:null}]`; remove null workaround |
| `.../category/.../get-all-categories.use-case.ts` | Modify | Remove `isCustom` |
| `prisma/schema.prisma` | Modify | `Category.userId` → `String` (required) |
| `prisma/migrations/<ts>_category_user_id_required/migration.sql` | Create | NOT NULL + drop partial index (+ down) |
| `prisma/scripts/provision-default-user-data.ts` | Create | Idempotent existing-user backfill |
| `prisma/seed.ts` | Modify | Categories per-user; consume shared constants |

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | Provisioner sets `isPrincipal` only on Principal; provisioning failure aborts sign-up | Mock use cases + runner |
| Unit | `GetAllCategories` no longer emits `isCustom`; repo reads own-only | Mock repo |
| Integration | Backfill idempotency; Movement reassignment before global delete; 0 null rows after | Real Prisma, seeded globals + movements |
| E2E | New sign-up yields 3 accounts / 15 categories / 2 groups, one principal | Real `POST /auth/sign-up` |

## Migration / Rollout

Down migration: `ALTER COLUMN user_id DROP NOT NULL` + recreate partial index. Safe — no row loses data; do NOT reintroduce `userId:null` global rows. Feature-commit revert restores hand-built sign-up. Backfill+reassign+delete MUST precede the NOT NULL migration.

## Open Questions

- None. Transactionality is settled on the `TransactionRunner` primitive (see "Provisioning wiring + failure semantics") — no fork remains. The `prisma.category.upsert()` cleanup in `prisma-category.repository.ts`/`seed.ts` stays an optional post-migration opportunity, not scope.
