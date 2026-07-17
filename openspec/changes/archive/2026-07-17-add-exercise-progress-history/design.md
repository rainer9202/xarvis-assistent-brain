# Design: Per-Exercise Progress History

Architectural design (the HOW) for `GET .../progress` returning a user's full
logged time-series for one exercise in one query. Task breakdown is deferred to
`sdd-tasks`.

## 1. Architecture Approach

No new pattern. A read path along the workout-session module's three hexagonal
layers: new port method → Prisma query → new use case → new controller route.
The use case reuses the cross-module `GetExerciseByIdUseCase` (already exported
by `ExerciseModule`, already imported into `WorkoutSessionModule`) for the
visibility/404 gate, then reads logged entries. It deliberately introduces NO
shared analytics module — the sibling `add-exercise-personal-records` stays a
separate future change (same narrow call as `add-session-exercise-counts`).

### Component map

```
workout-session/domain/ports/workout-session-exercise.repository.port.ts  [MOD] findLoggedEntriesForExercise + LoggedExerciseEntry type
.../infrastructure/repositories/prisma-workout-session-exercise.repository.ts  [MOD] joined findMany
.../application/use-cases/get-exercise-progress.use-case.ts               [NEW] visibility gate + map
.../infrastructure/controllers/exercise-progress.controller.ts            [NEW] GET /workout-sessions/exercises/:exerciseId/progress
workout-session.module.ts                                                 [MOD] register use case + controller
```

### Data flow

```
GET /workout-sessions/exercises/:exerciseId/progress (Bearer)
  → ExerciseProgressController.findProgress(@Param, @CurrentUser)
  → GetExerciseProgressUseCase.execute(exerciseId, userId)
      getExerciseById.execute(exerciseId, userId)   → throws 404 if null (visibility gate)
      repository.findLoggedEntriesForExercise(exerciseId, userId) → LoggedExerciseEntry[]  (1 query, [] if never logged)
      map → ExerciseProgressEntry[] (ordered by sessionDate asc)
  → ResponseInterceptor wraps → { statusCode, message, data: [...] }
```

## 2. Decisions (ADR-style)

### ADR-1 — Route lives in the workout-session module (real circular-import constraint)

**Choice.** New `ExerciseProgressController` in the workout-session module,
`@Controller('workout-sessions')`, route `@Get('exercises/:exerciseId/progress')`
→ `GET /workout-sessions/exercises/:exerciseId/progress`.
**Alternatives.** `GET /exercises/:id/progress` on `ExerciseController`; a second
`@Controller('exercises')` in the workout-session module.
**Rationale.** Confirmed real cycle: `workout-session.module.ts:24` imports
`ExerciseModule`; `exercise.module.ts` imports nothing from workout-session.
Serving from `ExerciseController` forces `ExerciseModule` to import
`WorkoutSessionModule` → `workout-session → exercise → workout-session` cycle.
The workout-session module OWNS the logged data and already depends on exercise,
so the route belongs here. The `workout-sessions/exercises/:exerciseId/progress`
path still reads exercise-centric for the frontend while honestly namespacing
the session-derived resource, and the 4-segment path can't collide with the
existing `@Get(':id')` (single segment). A dedicated third controller follows
the module's `WorkoutSession`/`WorkoutSessionExercise` split precedent.

### ADR-2 — Port returns raw `LoggedExerciseEntry[]`, reusable by personal-records

**Choice.** `findLoggedEntriesForExercise(exerciseId, userId): Promise<LoggedExerciseEntry[]>`
returning raw joined rows (`sessionId, sessionDate, routineId, routineName,
actualSets, actualReps, actualWeightGrams`); the use case maps to the response.
**Alternatives.** A progress-specific method returning the response shape; a
pre-aggregated max-weight/max-reps method now.
**Rationale.** `add-exercise-personal-records` reads the SAME base rows (all of a
user's logged entries for one exercise) to compute max weight/reps. Returning
raw per-entry rows lets that change reuse this method verbatim and do its own
aggregation. No PR-specific work is built now — just a shape that won't force the
next change to redo the query layer.

### ADR-3 — Visibility/404 reuses `GetExerciseByIdUseCase`; entries legitimately `[]`

**Choice.** The use case calls `getExerciseById.execute(exerciseId, userId)`
FIRST; on `null` it already throws `NotFoundException`
(`get-exercise-by-id.use-case.ts:41-42` — `findById` allows own OR global rows,
else null → 404), then queries logged entries.
**Rationale.** This is the exact "nonexistent id AND another user's custom
exercise both 404, indistinguishable" precedent (AGENTS.md ownership rule). A
visible-but-never-logged exercise passes the gate and the query returns `[]` +
200 — the two codepaths are distinct: 404 = failed visibility, `[]` = passed
visibility with no rows.

### ADR-4 — Single joined query; routine name comes free from the relation

**Choice.**
```ts
prisma.workoutSessionExercise.findMany({
  where: { exerciseId, workoutSession: { userId } },
  include: { workoutSession: { select: { id: true, date: true,
    routine: { select: { id: true, name: true } } } } },
  orderBy: { workoutSession: { date: 'asc' } },
});
```
**Rationale.** `WorkoutSessionExercise` has no `userId`; scoping is through the
parent `workoutSession.userId` (documented pattern). `WorkoutSession.routine`
(schema:188) is an existing relation, so routine id/name come free in the same
statement — NO separate lookup, no N+1. Prisma orders by the related
`workoutSession.date` scalar directly.

### ADR-5 — Ship unbounded; no LIMIT, no new index, no pagination

**Choice.** Return the full set as-is.
**Rationale.** The row ceiling for ONE user × ONE exercise is naturally small —
one row per session that logged it. Even an unrealistic 5-years-daily-same-lift
upper bound is ~1300 rows; typical is tens. `@@index([exerciseId])` on
`WorkoutSessionExercise` (schema:210) already covers the `where`; the sort runs
on that small filtered set, so no `@@index` on `WorkoutSession.date` is needed.
Pagination is out of scope (frontend didn't ask; sibling `add-session-exercise-counts`
avoided speculative infra). Add a cap only if profiling later shows need.

### ADR-6 — Response: own `ExerciseProgressEntry[]` type; full read fields

**Choice.** Use case defines `ExerciseProgressEntry = { sessionId, sessionDate,
routineId, routineName, actualSets, actualReps, actualWeightGrams }` and returns
`ExerciseProgressEntry[]`. Controller returns `{ message, data }`.
**Rationale.** This is a read (`Get`), so returning full mapped fields is allowed
(the `{ id }`-only rule is Create/Update/Delete). Each use case owning its
explicit response type matches the module convention.

## 3. Integration Points

- **Prisma** — no schema change, no migration (additive). Nested `include`
  composes with the existing table/relations.
- **`workout-session.module.ts`** — add the use case provider + the new
  controller; the `GetExerciseByIdUseCase` cross-module dependency is already
  wired via `imports: [ExerciseModule]`.
- **Response envelope** — `ResponseInterceptor` unchanged.

## 4. Test Surfaces Implied (Strict TDD — for `sdd-tasks` to slice)

Unit (jest, mocked deps):
- `prisma-workout-session-exercise.repository.spec.ts` — `findLoggedEntriesForExercise`
  calls `findMany` with `where.workoutSession.userId`, the routine include, and
  `orderBy.workoutSession.date: 'asc'`; maps rows → `LoggedExerciseEntry`;
  asserts a SINGLE `findMany` (no N+1).
- `get-exercise-progress.use-case.spec.ts` — (a) logged-across-sessions: maps +
  orders asc; (b) visible-but-never-logged → gate passes, entries `[]` → returns
  `[]`; (c) `getExerciseById` throws → 404 propagates, entries query NOT reached.

e2e (jest `@swc/jest`, real Postgres, `createAuthenticatedUser`):
- Log one exercise across 2+ sessions → returns entries ordered by `sessionDate`
  asc with the six fields.
- Visible exercise never logged → `[]` + 200.
- Nonexistent / other-user custom exercise id → 404.

## 5. Migration / Rollout

No migration required. Additive; revert the single feature commit to remove the
route, use case, and port method — everything else byte-for-byte unchanged.

## 6. Open Questions

None blocking. Personal-records aggregation intentionally deferred (ADR-2
leaves the reuse seam ready).
