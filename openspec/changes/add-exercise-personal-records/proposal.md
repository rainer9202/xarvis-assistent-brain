# Proposal: Exercise Personal Records

## Intent

Reports wants a single "personal bests" view: for every exercise a user has logged, what is the heaviest weight they have ever lifted, and in which session. Today the only way to answer this is to pull the full logged history (`GET /workout-sessions/exercises/:exerciseId/progress`, one call per exercise) and reduce it client-side — an explicit N+1 across the user's whole exercise catalog. The logged data (`WorkoutSessionExercise.actualWeightGrams`) exists but is only reachable one exercise at a time. This change adds one endpoint that returns every exercise's max-weight record in a fixed number of queries. Backlog item #4 (`PROJECT_CONTEXT.md:264`). Two product decisions were open in exploration and are now RESOLVED: (1) a record is MAX WEIGHT LIFTED only — the single highest `actualWeightGrams` ever logged for that exercise, no e1RM/formula; (2) the endpoint returns ALL exercises at once (no `:exerciseId` param), one entry per exercise with logged history.

## Scope

### In Scope
- Read endpoint returning the authenticated user's personal record per exercise: one entry for every exercise that has at least one logged `WorkoutSessionExercise` row, each carrying `exerciseId`, `exerciseName`, `maxWeightGrams`, and the source session context (`sessionId`, `sessionDate`, `routineId`, `routineName`) of the session where that max was achieved.
- Ownership scoping through `WorkoutSession.userId` (the child `WorkoutSessionExercise` has no `userId` of its own — same documented pattern as the progress sibling).
- A deterministic tie-break rule when two sessions share the same max weight for an exercise: EARLIEST `sessionDate` wins (the PR was first achieved then). Stated explicitly so ordering never depends on Postgres row order.
- Aggregation in a fixed number of queries (not N+1, not one-query-per-exercise), scaling with distinct-exercise count rather than total logged-row count.
- Unit + e2e tests (Strict TDD enabled).

### Out of Scope
- Any shared aggregation/analytics module (the siblings `add-session-exercise-counts` and `add-exercise-progress-history` both deliberately stayed narrow; same call here).
- e1RM / formula-based records, best-reps records, or per-set PRs — the schema stores one session-level aggregate row per (session, exercise), not per-set data, and the product decision is max weight only.
- Raw SQL (`$queryRaw` / `DISTINCT ON`) — zero raw-SQL precedent exists in this codebase; not introduced here.
- Changes to how exercises are logged, or to the shipped progress/counts endpoints.
- Pagination (frontend did not ask; the natural bound is distinct-exercise count, flagged in Risks).

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `exercise`: adds one requirement — expose the authenticated user's max-weight personal record for every exercise with logged history in a single call. Scenarios for sdd-spec to draft: (1) records-across-multiple-exercises returns one entry per logged exercise with the correct max and its source session; (2) tie on max weight resolves to the earliest session; (3) an exercise with zero logged history is absent from the response (not a null entry, not a 404); (4) a user with no logged history at all gets `[]` + 200.

## Approach

Add a workout-session-owned port method that computes each exercise's max `actualWeightGrams` scoped by `workoutSession.userId`, then resolves the winning session context, in two fixed queries (not N+1):

1. `groupBy(['exerciseId'], where: { workoutSession: { userId } }, _max: { actualWeightGrams })` — result set bounded by DISTINCT exercise count, not total row count. This is the codebase's first `groupBy`, but it stays within Prisma's typed query API (no raw SQL); the existing `_count` idiom already establishes Prisma-native aggregation as the sanctioned tool.
2. One deterministic follow-up `findMany` resolving the winning row per exercise — matched on `(exerciseId, actualWeightGrams)` pairs from step 1, joined to `workoutSession` (id, date, routine id/name) and `exercise` (name), ordered so the earliest `sessionDate` wins each tie.

The use case reduces these to one record entry per exercise and maps to an explicit response type. Because records are max-weight-only, `_max` expresses the aggregate directly — so the DB-side approach (exploration's Approach B) is viable and avoids pulling every logged row across all exercises into app memory (exploration's Approach A), whose "naturally small" row-count assumption does NOT hold at all-exercises scope for an active long-term user.

Route placement reuses the progress sibling's ADR-1 precedent verbatim: although the backlog wording reads `GET /exercises/records`, serving it from `ExerciseController` would force `ExerciseModule` to import `WorkoutSessionModule`, inverting the existing one-way dependency (`workout-session → exercise`) into a cycle. The logged data lives in the workout-session module, which already depends on exercise, so the controller/use case live there and the path is namespaced under `workout-sessions` (recommended `GET /workout-sessions/exercises/records`, mirroring the shipped `/workout-sessions/exercises/:exerciseId/progress`). Final exact path string → design.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `workout-session/domain/ports/workout-session-exercise.repository.port.ts` | Modified | New `findPersonalRecords(userId)` read method + `PersonalRecordEntry` type |
| `.../repositories/prisma-workout-session-exercise.repository.ts` | Modified | Implement `groupBy` `_max` + deterministic follow-up query (2 fixed queries) |
| `workout-session/application/use-cases/*` | New | `GetPersonalRecordsUseCase` (reduce to one record per exercise, map response) |
| controller + route | New | Serve `GET /workout-sessions/exercises/records` (final placement → design) |
| `workout-session.module.ts` | Modified | Register the new use case + controller |
| `test/**`, `**/*.spec.ts` | New | e2e + unit (Strict TDD) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `groupBy` combined with a relation `where` filter behaves unexpectedly on this Prisma 7 version | Med | Verify in the repository unit test and a real e2e run; the `where: { workoutSession: { userId } }` shape is the same relation-scoping already used by `findLoggedEntriesForExercise` |
| First `groupBy`-on-a-relation-filter usage sets a precedent (`groupBy` with `_sum` already exists on flat scalar filters in `prisma-account.repository.ts`) | Low | Stays inside Prisma's typed API (not raw SQL); documents that a relation `where` inside `groupBy` is allowed when Prisma-native. Design should note it |
| Follow-up query re-fetches ties, inflating rows before reduction | Low | Ties on identical max weight are rare and bounded per exercise; the use case reduces to earliest session. If profiling ever shows cost, a `DISTINCT ON` raw query is the escape hatch (explicitly not taken now) |
| No index on `WorkoutSession.date` for the tie-break order | Low | Filtered per-user set is small; sort is cheap. Add `@@index` only if profiling shows need (same call as progress ADR-5) |
| Unbounded result count for a user with a huge exercise catalog | Low | Bounded by distinct-exercise count, not total logged rows; frontend asked no pagination. Flag only |

## Open Questions (surface, not resolve)

- **Exact route string.** Recommend `GET /workout-sessions/exercises/records` (workout-session module, mirrors the shipped progress path). Design confirms the final string and controller placement.
- **Tie-break direction confirmation.** Proposal fixes EARLIEST session wins on equal max weight ("PR first achieved then"). If reports prefers "most recent occurrence," that flips one `orderBy` — surface at design, but earliest is the default.
- **Include `exerciseName` in the response?** Recommended yes (the progress endpoint already resolves routine name from its relation; exercise name comes free from the join and spares the frontend a lookup). Confirm field set at spec.

## Rollback Plan

Additive, no migration (`WorkoutSessionExercise` and its `@@index([exerciseId])` / `WorkoutSession @@index([userId])` already exist). Revert the single feature commit; the endpoint, use case, and port method disappear, everything else byte-for-byte unchanged. No data cleanup.

## Dependencies

- None new. Lives in the workout-session module, which already owns `WorkoutSessionExercise` and its Prisma repository. No cross-module visibility gate is needed here (unlike the per-exercise progress endpoint): ownership is enforced purely by scoping the query through `WorkoutSession.userId`, and an all-exercises list has no single `:exerciseId` to 404 on.

## Success Criteria

- [ ] `GET /workout-sessions/exercises/records` returns one entry per exercise with logged history: `exerciseId`, `exerciseName`, `maxWeightGrams`, `sessionId`, `sessionDate`, `routineId`, `routineName`.
- [ ] The reported `maxWeightGrams` is the single highest `actualWeightGrams` ever logged for that exercise by the user.
- [ ] Ties on max weight resolve to the earliest `sessionDate`, deterministically.
- [ ] An exercise with zero logged history is absent from the response; a user with no history gets `[]` + 200 (never a 404, never a null entry).
- [ ] Records resolved in a fixed number of queries (no N+1, no per-exercise loop), verified in tests.
- [ ] Unit + e2e suites green under Strict TDD.
