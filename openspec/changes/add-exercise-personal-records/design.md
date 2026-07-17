# Design: Exercise Personal Records

Architectural design (the HOW) for `GET /workout-sessions/exercises/records`
returning every logged exercise's max-weight personal record for the
authenticated user in two fixed queries. Task breakdown is deferred to
`sdd-tasks`.

## 1. Architecture Approach

No new pattern. A read path along the workout-session module's three hexagonal
layers: new port method → two-query Prisma implementation → new use case → new
controller route. It reuses the exact code shape shipped for the progress
sibling. NO shared analytics module (same narrow call as the two siblings).
Ownership is enforced purely by scoping through `WorkoutSession.userId`; there
is no `:exerciseId` param, so no cross-module visibility/404 gate is needed
(unlike progress) — `GetExerciseByIdUseCase` is NOT involved here.

### Component map

```
domain/ports/workout-session-exercise.repository.port.ts        [MOD] findPersonalRecords + PersonalRecordEntry type
infrastructure/repositories/prisma-workout-session-exercise.repository.ts [MOD] groupBy _max + deterministic follow-up findMany
application/use-cases/get-personal-records.use-case.ts           [NEW] reduce ties → one record per exercise, map response
infrastructure/controllers/exercise-personal-records.controller.ts [NEW] GET /workout-sessions/exercises/records
workout-session.module.ts                                        [MOD] register use case + controller
```

### Data flow

```
GET /workout-sessions/exercises/records (Bearer)
  → ExercisePersonalRecordsController.findRecords(@CurrentUser)
  → GetPersonalRecordsUseCase.execute(userId)
      repository.findPersonalRecords(userId)            → PersonalRecordEntry[] (2 queries; [] if no history)
        Q1 groupBy exerciseId, _max weight  → distinct-exercise-bounded pairs
        Q2 findMany matched pairs, date asc → winning-candidate rows (ties included)
      reduce: keep first row per exerciseId (= earliest date = PR) → map
  → ResponseInterceptor wraps → { statusCode, message, data: [...] }
```

## 2. Decisions (ADR-style)

### ADR-1 — Route in the workout-session module (real circular-import constraint)

**Choice.** New `ExercisePersonalRecordsController`, `@Controller('workout-sessions')`,
`@Get('exercises/records')` → `GET /workout-sessions/exercises/records`.
**Alternatives.** `GET /exercises/records` on `ExerciseController`.
**Rationale.** Confirmed real cycle (progress design ADR-1, verbatim precedent):
`workout-session.module.ts:26` imports `ExerciseModule`; exercise imports
nothing back. Serving from `ExerciseController` forces `ExerciseModule` to
import `WorkoutSessionModule` → cycle. The workout-session module OWNS the
logged data. A dedicated third read controller mirrors the shipped
`ExerciseProgressController` split. No route collision: `exercises/records`
(2 segments) can't match `exercises/:exerciseId/progress` (3 segments) and
there is no single-segment `exercises/:id` route under `workout-sessions`.

### ADR-2 — Two fixed queries: groupBy `_max` + matched follow-up (first groupBy on a relation filter — sanctioned)

**Choice.**
```ts
// Q1 — distinct-exercise-bounded, not row-bounded
const grouped = await this.prisma.workoutSessionExercise.groupBy({
  by: ['exerciseId'],
  where: { workoutSession: { userId } },
  _max: { actualWeightGrams: true },
});
const pairs = grouped
  .filter((g) => g._max.actualWeightGrams !== null)
  .map((g) => ({ exerciseId: g.exerciseId, actualWeightGrams: g._max.actualWeightGrams! }));
if (pairs.length === 0) return [];

// Q2 — winning candidate rows; userId re-scoped (a (exerciseId,weight) pair
// could otherwise match another user's row), date asc for the tie-break
const rows = await this.prisma.workoutSessionExercise.findMany({
  where: { workoutSession: { userId }, OR: pairs },
  include: {
    exercise: { select: { name: true } },
    workoutSession: { select: { id: true, date: true, routine: { select: { id: true, name: true } } } },
  },
  orderBy: { workoutSession: { date: 'asc' } },
});
```
**Alternatives.** Approach A (pull all rows, aggregate in memory) — rejected: the
"naturally small" assumption fails at all-exercises scope. `distinct: ['exerciseId']`
to drop ties DB-side — rejected: introduces a SECOND novel Prisma feature; the
proposal's plan is an app-side reduce.
**Rationale.** `groupBy` itself is not new — `prisma-account.repository.ts`
already uses it with `_sum` on flat scalar filters (`accountId`, `movementType`).
What IS new here is combining `groupBy` with a nested RELATION `where` filter
(`workoutSession: { userId }`) rather than a flat scalar one — that combination
has no precedent in this codebase. Sanctioned because it still stays inside
Prisma's TYPED query API (no `$queryRaw`, no raw SQL) — same category as the
existing `_count`/`groupBy` idiom, just a different filter shape. The relation
`where: { workoutSession: { userId } }` is the exact scoping shape already
proven (on non-groupBy queries) by `findLoggedEntriesForExercise`. Q2 re-scopes
`userId` explicitly: this is a correctness requirement, not decoration.

### ADR-3 — Tie-break: earliest session wins, enforced by `orderBy` date asc + first-per-exercise reduce

**Choice.** Q2 orders `workoutSession.date: 'asc'`; the use case reduces
candidate rows keeping the FIRST seen per `exerciseId` via an explicit
has-guard — NOT a plain `map.set()` per iteration, which would overwrite on
every row and silently produce latest-wins instead of earliest-wins:
```ts
const byExercise = new Map<string, (typeof rows)[number]>();
for (const row of rows) {
  if (!byExercise.has(row.exerciseId)) byExercise.set(row.exerciseId, row);
}
```
First-in-asc-order = earliest date = the PR ("first achieved then"). Final;
no evidence to override.
**Rationale.** Determinism never depends on Postgres row order. Ties on identical
max weight are rare and bounded per exercise; the follow-up may re-fetch them,
the reduce collapses them. Escape hatch if profiling ever shows cost: raw
`DISTINCT ON` — explicitly NOT taken now.

### ADR-4 — Response: own `PersonalRecordEntry[]`; includes `exerciseName`

**Choice.** Port type and use-case response:
```ts
type PersonalRecordEntry = {
  exerciseId: string; exerciseName: string; maxWeightGrams: number;
  sessionId: string; sessionDate: Date; routineId: string; routineName: string;
};
```
Port: `findPersonalRecords(userId: string): Promise<PersonalRecordEntry[]>`
(returns ordered candidate rows, ties included — the use case reduces).
Controller returns `{ message, data }`.
**Rationale.** Read endpoint → full mapped fields allowed (the `{ id }`-only rule
is Create/Update/Delete). `exerciseName` (`exercise.name`, NOT `nameEs`) comes
free from the join and spares the frontend a lookup — same free-relation logic
as progress's `routineName`. Each use case owns its explicit response type.

## 3. Integration Points

- **Prisma** — no schema change, no migration. `groupBy`/nested `include`
  compose over existing tables, relations, and indexes
  (`WorkoutSessionExercise @@index([exerciseId])`, `WorkoutSession @@index([userId])`).
- **`workout-session.module.ts`** — add `GetPersonalRecordsUseCase` provider +
  `ExercisePersonalRecordsController`. No new module import.
- **Response envelope** — `ResponseInterceptor` unchanged.

## 4. Test Surfaces Implied (Strict TDD — for `sdd-tasks` to slice)

Unit (jest, mocked deps):
- `prisma-workout-session-exercise.repository.spec.ts` — `findPersonalRecords`
  calls `groupBy` with `by:['exerciseId']`, `where.workoutSession.userId`,
  `_max.actualWeightGrams`; then a SINGLE `findMany` with the `OR` pairs, the
  `userId` re-scope, the exercise+routine include, and `orderBy.workoutSession.date:'asc'`;
  maps rows → `PersonalRecordEntry`; asserts exactly two queries (no N+1);
  returns `[]` when `groupBy` is empty (skips Q2).
- `get-personal-records.use-case.spec.ts` — (a) multiple exercises → one entry
  each with correct max + source session; (b) tie on max weight → earliest
  session kept, later dropped; (c) empty repository result → `[]`.

e2e (jest `@swc/jest`, real Postgres, `createAuthenticatedUser`):
- Log several exercises across sessions → one entry per exercise with the max
  and its seven fields.
- Tie: same max weight in two sessions → earliest `sessionDate` returned.
- Exercise with zero logged history → absent from the list (not null, not 404).
- User with no history at all → `[]` + 200.
- Cross-user isolation → another user's heavier lift never appears.

## 5. Migration / Rollout

No migration required. Additive; revert the single feature commit to remove the
route, use case, and port method — everything else byte-for-byte unchanged.

## 6. Open Questions

None blocking. All three proposal open questions resolved: route (ADR-1),
tie-break (ADR-3), `exerciseName` field set (ADR-4).
