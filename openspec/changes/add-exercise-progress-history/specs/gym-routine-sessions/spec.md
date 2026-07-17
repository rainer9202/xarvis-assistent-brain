# Delta for Gym Routine Sessions

## ADDED Requirements

### Requirement: Per-Exercise Logged Progress History

The system MUST expose a read endpoint that returns the authenticated
user's full logged history for one `exerciseId`, sourced from
`WorkoutSessionExercise` joined to its parent `WorkoutSession` and the
session's `Routine` — resolved in one query (no N+1 per session).

(Exact route path/controller placement is a design decision, not fixed by
this spec — the response envelope and field contract below apply regardless
of final path.)

Each item in the response `data` array MUST include exactly these fields:
`sessionId`, `sessionDate`, `routineId`, `routineName`, `actualSets`,
`actualReps`, `actualWeightGrams`. `sessionDate` MUST equal the parent
`WorkoutSession.date`. `routineName` MUST be resolved from the session's
`Routine.name` (same routine-lookup convention as
`GetAllWorkoutSessionsUseCase`), not stored redundantly on
`WorkoutSessionExercise`. `actualSets`, `actualReps`, and
`actualWeightGrams` MUST equal the corresponding `WorkoutSessionExercise`
columns unchanged.

`data` MUST be ordered by `sessionDate` ascending.

The system MUST scope results to the authenticated user via the parent
`WorkoutSession.userId` — `WorkoutSessionExercise` has no `userId` column of
its own, so ownership MUST NOT be checked directly on that table.

Before returning history, the system MUST verify the `exerciseId` is
visible to the authenticated user using the same rule as
`GetExerciseByIdUseCase`: the exercise exists AND (`Exercise.userId` equals
the authenticated user's id OR `Exercise.userId` is `null`, i.e. global
catalog). A nonexistent `exerciseId` and an existing `exerciseId` owned by a
different user MUST both be rejected identically — the system MUST NOT
distinguish "doesn't exist" from "not yours" in the response.

An `exerciseId` that IS visible to the user but has never been logged in
any of their sessions MUST return an empty `data` array with `200`, not a
`404` — visibility and logged-history-existence are independent checks.

#### Scenario: Exercise logged across multiple sessions

- GIVEN an authenticated user has logged the same exercise in three
  different workout sessions on different dates
- WHEN the client requests progress history for that `exerciseId`
- THEN the response is `200` with a `data` array of three entries
- AND the entries are ordered by `sessionDate` ascending
- AND each entry includes `sessionId`, `sessionDate`, `routineId`,
  `routineName`, `actualSets`, `actualReps`, `actualWeightGrams` matching
  the logged `WorkoutSessionExercise` and parent `WorkoutSession`/`Routine`
  rows
- AND the history is resolved without issuing a separate database query
  per session

#### Scenario: Exercise visible but never logged

- GIVEN an authenticated user can see a given `exerciseId` (global catalog
  exercise, or their own custom exercise) but has never logged it in any
  workout session
- WHEN the client requests progress history for that `exerciseId`
- THEN the response is `200` with `data: []`

#### Scenario: Exercise does not exist

- GIVEN no `Exercise` row exists for the given `exerciseId`
- WHEN the client requests progress history for that `exerciseId`
- THEN the response is `404`

#### Scenario: Exercise belongs to another user's custom exercise

- GIVEN an `Exercise` row exists for the given `exerciseId` with
  `userId` set to a different user than the authenticated caller
- WHEN the client requests progress history for that `exerciseId`
- THEN the response is `404`
- AND the response body is indistinguishable in shape from the
  nonexistent-`exerciseId` case
