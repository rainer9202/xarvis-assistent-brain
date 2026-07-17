# Design: Session List Exercise Counts

Architectural design (the HOW) for adding `loggedExerciseCount` and
`totalExerciseCount` to each `GET /workout-sessions` item. Task breakdown is
deferred to `sdd-tasks`.

## 1. Architecture Approach

No new pattern. This is a narrow, point-in-time enrichment of the existing
`GetAllWorkoutSessionsUseCase` list path, along the module's three hexagonal
layers. It deliberately does NOT introduce a shared aggregation/analytics
module — the two sibling requests (`add-exercise-progress-history`,
`add-exercise-personal-records`) are separate future changes and may or may not
share code later; nothing here is designed for that.

Both counts are resolved with **zero new queries and zero N+1**:

- `loggedExerciseCount` — add the already-proven `_count` relation aggregate
  (`PrismaRoutineRepository.findAll`, line 25) onto the existing
  `workoutSession.findMany` in `PrismaWorkoutSessionRepository.findAll`.
- `totalExerciseCount` — reuse the `exerciseCount` already carried by the
  `getAllRoutines.execute(userId)` result the use case ALREADY awaits
  (`get-all-workout-sessions.use-case.ts:28-31`); just widen the existing
  `routineNameById` Map to also hold that count.

### Component map

```
infrastructure/repositories/prisma-workout-session.repository.ts  [MOD] findAll: _count.exercises include + wrapper return
domain/ports/workout-session.repository.port.ts                   [MOD] new WorkoutSessionWithLoggedCount type; findAll return
application/use-cases/get-all-workout-sessions.use-case.ts        [MOD] widen Map value; map 2 new integer fields
```

Controller, DTO, entity, and `workout-session.module.ts` are UNCHANGED.

### Data flow

```
GET /workout-sessions (Bearer)
  → WorkoutSessionController.findAll(@CurrentUser())        [unchanged]
  → GetAllWorkoutSessionsUseCase.execute(userId)
      Promise.all([
        repository.findAll(userId)          → [{ session, loggedExerciseCount }]  (1 query, _count)
        getAllRoutines.execute(userId)      → [{ id, name, exerciseCount, ... }]  (1 query, already batched)
      ])
      routineById = Map(id → { name, exerciseCount })
      map each → { ...existing, loggedExerciseCount, totalExerciseCount }
  → ResponseInterceptor wraps → { statusCode, message, data: [...] }
```

## 2. Decisions (ADR-style)

### ADR-1 — `loggedExerciseCount` via relation `_count` in the existing `findMany` (single query)

**Context.** `findAll` today runs one `workoutSession.findMany({ where: { userId }, orderBy: { date: 'desc' } })` returning `WorkoutSessionEntity[]`. `WorkoutSession` has an `exercises WorkoutSessionExercise[]` relation.

**Decision.** Add `include: { _count: { select: { exercises: true } } }` to that same `findMany`. Change `findAll`'s return to a wrapper `WorkoutSessionWithLoggedCount[]`, mirroring the existing `RoutineWithExerciseCount` precedent:

```ts
export type WorkoutSessionWithLoggedCount = {
  session: WorkoutSessionEntity;
  loggedExerciseCount: number;
};
```

Map `record._count.exercises` per row. For N sessions this stays **one SQL query** (`_count` is a correlated aggregate in the same statement, not a per-row round-trip) — no N+1.

**Rejected.** A separate `groupBy`/`count` per session (reintroduces the exact N+1 the proposal forbids); a raw SQL aggregate (unwarranted — `_count` is the codebase-blessed idiom).

### ADR-2 — `totalExerciseCount` is the routine's LIVE current count, NOT a session-creation snapshot

**Context.** Each session is created FROM a routine (`WorkoutSession.routineId`). Routines are editable with **full-replace** semantics (`PrismaRoutineRepository.update` deletes then recreates `RoutineExercise` rows). So "planned exercises" can change after a session exists. The schema has **no** snapshot column on `WorkoutSession` recording the planned count at creation time.

**Decision.** `totalExerciseCount` = the routine's **current** `RoutineExercise` count, read live via the already-fetched `getAllRoutines` result (`exerciseCount`). No snapshot is taken or stored.

**Rationale.** (a) It is free — the count is already in memory; a snapshot would need a new `WorkoutSession` column, a migration (the proposal's rollback plan is explicitly *additive, no migration*), and capture logic in `CreateWorkoutSessionUseCase` — all out of scope. (b) The frontend label is "X done / Y planned" for a live routine; showing the routine's current shape is the intuitive reading. (c) `WorkoutSession.routineId` is `onDelete: Restrict` AND `DeleteRoutineUseCase` guards via `countSessionsByRoutineId`, so a routine referenced by any session **cannot** be deleted — the routine is always present in the `getAllRoutines` Map, so `totalExerciseCount` always resolves.

**Consequence (documented, accepted).** After a routine is trimmed, `loggedExerciseCount` CAN exceed `totalExerciseCount` (logged 5, planned now 3). These are two independent aggregates, not an intersection — this is correct, not a bug. The spec states "planned = routine exercise count at query time" and permits logged > planned. Defensive fallback: routine absent from Map → `totalExerciseCount: 0` (mirrors the existing `routineName` `?? item.routineId` fallback).

**Rejected.** Snapshot-at-creation (needs migration + capture, out of scope, and would drift from a later-edited routine the user now sees); clamping logged to planned (hides real logged data).

### ADR-3 — `loggedExerciseCount` is the raw row count (no status/soft-delete filter)

**Context.** Checked `WorkoutSessionExercise`: it has **no** status or soft-delete flag (`id, workoutSessionId, exerciseId, actualSets, actualReps, actualWeightGrams, timestamps`). AGENTS.md "Delete semantics" mandates physical row removal, never soft-delete flags.

**Decision.** `_count.exercises` counts all rows unconditionally — every existing `WorkoutSessionExercise` row IS a logged exercise. No `where` filter on the count.

**Rationale.** There is no "deleted-but-present" state to exclude; a deleted logged entry is physically gone. Adding a filter would be dead code.

### ADR-4 — Response shape: two integer fields appended; envelope and pagination unchanged

**Context.** `GetAllWorkoutSessionsResponse` is `{ id, routineId, routineName, date, finishedAt, createdAt }`. The endpoint is **not** paginated (`findMany` has no `skip`/`take`; controller returns `data` as a plain array).

**Decision.** Append `loggedExerciseCount: number` and `totalExerciseCount: number` to `GetAllWorkoutSessionsResponse`. Widen the use case's Map from `id → name` to `id → { name, exerciseCount }`; read both while mapping. The controller's `{ message, data }` envelope, `data`-as-plain-array shape, ordering (`date desc`), and every existing field stay **byte-for-byte identical** — this change only ADDS two keys. No pagination is introduced (out of scope).

**Rationale.** Matches the module's "each use case defines its own explicit response type" convention and the `GetAllRoutinesResponse` precedent (which already surfaces `exerciseCount`). These are `GetAll` reads, so returning richer fields is allowed (AGENTS.md rule #9 applies only to Create/Update/Delete).

## 3. Integration Points

- **Prisma** — no schema change, no migration. `_count` composes with the existing `findMany`; `RoutineExercise`/`WorkoutSessionExercise` already exist.
- **`workout-session.module.ts`** — unchanged; no new provider, `getAllRoutines` cross-module dependency already wired.
- **Response envelope** — `ResponseInterceptor` unchanged.

## 4. Test Surfaces Implied (Strict TDD — for `sdd-tasks` to slice)

Unit (jest, mocked deps):
- `prisma-workout-session.repository.spec.ts` — `findAll` calls `findMany` with the `_count.exercises` include; maps `_count.exercises` → `loggedExerciseCount`; asserts a SINGLE `findMany` call (no per-session count → no N+1).
- `get-all-workout-sessions.use-case.spec.ts` — partially-logged (logged 2, total 4); none-logged (logged 0, total = routine count); **exceeds-planned edge** (logged 5 > total 3 both returned as-is); routine missing from Map → `totalExerciseCount: 0`; existing fields still mapped.

e2e (jest `@swc/jest`, real Postgres, `createAuthenticatedUser`):
- Create routine with 4 exercises → create session → log 2 → `GET /workout-sessions` returns `loggedExerciseCount: 2`, `totalExerciseCount: 4`; other fields unchanged. (Optional second scenario: trim routine to 3 after logging 2 → total reflects live 3.)

## 5. Risks / Assumptions Carried Forward

- **Live-count decision (ADR-2)** means `loggedExerciseCount > totalExerciseCount` is a valid, expected state after routine edits — the spec MUST state this so it is not later "fixed."
- **No pagination** assumed for this endpoint (unchanged). If opt-in pagination is added later, `_count` composes with the same `findMany` — note only, not in scope.
- `findAll` return-type change (`WorkoutSessionEntity[]` → `WorkoutSessionWithLoggedCount[]`) touches the port; the only caller is this use case, so blast radius is contained.
