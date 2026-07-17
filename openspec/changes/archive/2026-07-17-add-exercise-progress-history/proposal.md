# Proposal: Per-Exercise Progress History

## Intent

Reports wants to graph how reps and weight for one exercise evolve over time ("am I lifting more on bench than a month ago?"). Today the only way to reconstruct that is `GET /workout-sessions` (no logged data) plus `GET /workout-sessions/:id` per session — an explicit N+1 that grows with the user's history. The logged data (`WorkoutSessionExercise.actualSets/actualReps/actualWeightGrams`) exists but is only reachable one session at a time. Requested by the xarvis-gym-routine-sessions frontend (2026-07-15, priority Media). This change adds a single endpoint returning a user's full logged time-series for one exercise in one query.

## Scope

### In Scope
- Read endpoint returning the authenticated user's logged entries for one `exerciseId`, ordered by session date ascending; each entry carries `sessionId`, `sessionDate`, `routineId`, `routineName`, `actualSets`, `actualReps`, `actualWeightGrams`.
- One backend query joining `WorkoutSessionExercise → WorkoutSession → Routine`; no N+1.
- Exercise visibility check (nonexistent id and another user's custom exercise both 404; never-logged visible exercise returns `[]` + 200).
- Unit + e2e tests (Strict TDD enabled).

### Out of Scope
- Any shared aggregation/analytics module (the sibling `add-session-exercise-counts` deliberately stayed narrow; same call here).
- Changes to how exercises are logged, or to `add-session-exercise-counts` (already shipped).
- `add-exercise-personal-records` (next sibling request).
- Pagination (frontend did not ask; flagged in Risks).

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `exercise`: adds one requirement — expose per-exercise logged progress history (3 scenarios drafted by frontend: logged-across-sessions, never-logged→empty-200, invisible-id→404). Delta spec is the reuse source for sdd-spec.

## Approach

Add a workout-session-owned port method `findLoggedEntriesForExercise(exerciseId, userId)` returning child rows with parent session date/routine (single query: `where: { exerciseId, workoutSession: { userId } }`, `include` session+routine, `orderBy` session date asc). `WorkoutSessionExercise` has no `userId` of its own — user scoping is through the parent session (existing documented pattern). A new use case validates visibility by reusing `GetExerciseByIdUseCase.execute(id, userId)` (already implements "own OR global, else null→404" — exactly the not-found-vs-not-mine precedent), then maps the entries. The workout-session module already imports `ExerciseModule`, so no new coupling.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `workout-session/domain/ports/workout-session-exercise.repository.port.ts` | Modified | New `findLoggedEntriesForExercise` read method |
| `.../repositories/prisma-workout-session-exercise.repository.ts` | Modified | Implement the joined query |
| `workout-session/application/use-cases/*` | New | `GetExerciseProgressUseCase` (visibility via `GetExerciseByIdUseCase` + entries) |
| controller + route | New | Serve `GET /exercises/:id/progress` (final placement → design) |
| `test/**`, `**/*.spec.ts` | New | e2e + unit (Strict TDD) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Unbounded result set (years of logs for one exercise) | Med | Frontend asked no pagination; flag natural-bound concern; `GET /movements` page/limit template exists if design opts in |
| No index on `WorkoutSession.date` for the order-by | Low | Per-exercise/user set is small; sort is cheap. Add `@@index` only if profiling shows need |
| Route placement forces a circular import | Med | `ExerciseController` can't call a workout-session use case (exercise→workout-session would invert existing dep). Serve from the workout-session module; design picks exact path |

## Open Questions (surface, not resolve)

- **Reuse shape for `add-exercise-personal-records`.** That request (max weight/reps per exercise) reads the same "logged entries across sessions" rows. Shape `findLoggedEntriesForExercise` so PRs can reuse it — without pre-building its aggregation now. Decide in design.
- **Endpoint path.** Recommend `GET /exercises/:id/progress` for frontend ergonomics, served by the workout-session module (owns the data, already depends on exercise module for visibility). Final path/controller → design.

## Rollback Plan

Additive, no migration (`WorkoutSessionExercise` and its `exerciseId`/`workoutSessionId` indexes already exist). Revert the single feature commit; the endpoint and port method disappear, everything else byte-for-byte unchanged. No data cleanup.

## Dependencies

- None new. Reuses the existing `ExerciseModule → GetExerciseByIdUseCase` dependency already wired into the workout-session module.

## Success Criteria

- [ ] `GET .../:id/progress` returns entries ordered by `sessionDate` asc with the six required fields.
- [ ] Never-logged visible exercise returns `[]` + 200; nonexistent or other-user custom id returns 404.
- [ ] History resolved in one query (no N+1), verified in tests.
- [ ] Unit + e2e suites green under Strict TDD.
