# Proposal: Session List Exercise Counts

## Intent

`GET /workout-sessions` (`GetAllWorkoutSessionsUseCase`) returns `{ id, routineId, routineName, date, finishedAt, createdAt }` — no exercise-count info. The session list row (`session-row.tsx`, used on both the Sessions and Home screens) needs to show "X done / Y planned" per session. Without these fields the frontend must call `GET /workout-sessions/:id` + `GET /routines/:id` per row — an N+1 they have ruled out. Requested by the xarvis-gym-routine-sessions frontend team (2026-07-15, priority Media). This change adds two integer fields to each list item so the list is self-sufficient.

## Scope

### In Scope
- Add `loggedExerciseCount` (count of `WorkoutSessionExercise` rows for the session) and `totalExerciseCount` (the routine's current `RoutineExercise` count) to each `GET /workout-sessions` item.
- Compute both without a backend N+1 (see Approach).
- Unit + e2e tests (Strict TDD is enabled).

### Out of Scope
- The speculated shared "progress/analytics" aggregation module — see Open Question (surfaced, not decided).
- The other two frontend requests: `add-exercise-progress-history`, `add-exercise-personal-records`.
- Pagination of this endpoint (separate pending request; see Risks).
- No response fields removed/renamed; `GET /workout-sessions/:id` unchanged.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `workout-session`: adds one requirement — expose `loggedExerciseCount` and `totalExerciseCount` on each session-list item. Delta spec; the frontend-drafted delta (2 scenarios: partially-logged and none-logged) is the reuse source for sdd-spec.

## Approach

Enrich the existing batched query, do not add per-row queries. `totalExerciseCount` is already available: the use case fetches `getAllRoutines.execute(userId)`, whose items carry `exerciseCount` (via routine `_count`) — extend the existing `routineNameById` Map to also carry that count (zero new queries). `loggedExerciseCount` is added by including `_count: { select: { exercises: true } }` on the existing `workoutSession.findMany` in `PrismaWorkoutSessionRepository.findAll` — the exact `_count` pattern already proven in `PrismaRoutineRepository.findAll`, no extra round-trip. Both counts are integers mapped explicitly in the use-case response type.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `.../workout-session/infrastructure/repositories/prisma-workout-session.repository.ts` | Modified | `findAll` includes `_count.exercises`; return carries logged count |
| `.../workout-session/domain/ports/workout-session.repository.port.ts` | Modified | `findAll` return type carries logged count (new wrapper type, mirrors `RoutineWithExerciseCount`) |
| `.../workout-session/application/use-cases/get-all-workout-sessions.use-case.ts` | Modified | Add both fields to response; extend routine Map with `exerciseCount` |
| `test/**`, `**/*.spec.ts` | New | e2e + unit coverage (Strict TDD) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Reintroducing an N+1 at the backend (per-session count query) | Med | Use relation `_count` in the single `findMany` + already-fetched routine counts; assert query shape in repo test |
| `loggedExerciseCount > totalExerciseCount` after a routine is edited (full-replace removes planned exercises post-session) | Med | Counts are independent aggregates, not an intersection; spec must state "planned = routine count at query time" and allow logged to exceed it |
| Future opt-in pagination on this endpoint changes the query | Low | `_count` composes with the same `findMany`; note as cross-cutting, don't scope in |

## Rollback Plan

Additive, no migration (`WorkoutSessionExercise`/`RoutineExercise` already exist). Revert the single feature commit; the two fields disappear and the rest of the list item is byte-for-byte unchanged. No data cleanup.

## Dependencies

- None new. Reuses the existing `GetAllRoutinesUseCase` cross-module dependency already wired into this use case.

## Open Question (decide before design)

- **Shared root cause vs. narrow addition.** The frontend doc notes this request shares a root cause with `add-exercise-progress-history` and `add-exercise-personal-records` (all aggregate over logged session-exercise data) and suggests one shared mechanism (aggregates table/view or a `progress`/`analytics` module) instead of ad-hoc endpoints. Grounded finding: the two counts here are trivial relation aggregates co-located with the existing session-list query (routine count already fetched; logged count is one `_count` line), whereas the other two aggregate historical time-series/max data — a different query shape. Decide: (a) ship the narrow additive enrichment now (cheap, low-risk), or (b) invest in a shared aggregation mechanism this change would seed. Not resolved here — it materially affects design.

## Success Criteria

- [ ] Each `GET /workout-sessions` item includes integer `loggedExerciseCount` and `totalExerciseCount`.
- [ ] A session with 2 of 4 logged returns `loggedExerciseCount: 2`, `totalExerciseCount: 4`.
- [ ] A session with none logged returns `loggedExerciseCount: 0` and `totalExerciseCount` = routine's current exercise count.
- [ ] No backend N+1: counts resolved via `_count` + already-batched routines (verified in tests).
- [ ] Existing list fields unchanged; unit + e2e suites green under Strict TDD.
