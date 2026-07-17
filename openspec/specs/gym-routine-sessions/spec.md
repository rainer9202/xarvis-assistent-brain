# Gym Routine Sessions Specification

> **Note**: This file currently documents only SDD-tracked changes to the gym-routine-sessions domain, starting from the `add-session-exercise-counts` change (2026-07-17). The domain's other existing endpoints (workout-session create/finish/delete/get-by-id, routine list/create/update/delete, exercise log, body metrics) predate SDD adoption and are not yet retroactively specified. Future SDD changes touching other endpoints will incrementally build out this spec.

## ADDED Requirements

### Requirement: Workout Session List Exercise Counts

Each item in the `data` array returned by `GET /workout-sessions`
(`{ statusCode, message, data }` response envelope) MUST include two integer
fields: `loggedExerciseCount` and `totalExerciseCount`.

`loggedExerciseCount` MUST equal the number of `WorkoutSessionExercise`
records logged against that session at query time.

`totalExerciseCount` MUST equal the number of exercises currently defined on
the session's routine (`RoutineExercise` count for `routineId`) at query
time — the routine's *current* state, not a snapshot from when the session
was created.

The system MUST NOT issue an additional per-session database query to compute
either count; both MUST be resolved via `_count` on the existing batched
`findAll` query and the already-fetched routines list (no N+1).

`loggedExerciseCount` MAY be greater than `totalExerciseCount`. The two counts
are independent aggregates, not an intersection — because a routine update is
a full-replace operation, a routine can later be edited to have fewer
exercises than were logged in an earlier session. The system MUST NOT clamp
`loggedExerciseCount` to `totalExerciseCount` and MUST NOT return an error in
this case.

All other existing fields on each item (`id`, `routineId`, `routineName`,
`date`, `finishedAt`, `createdAt`) MUST remain unchanged in shape and value.

#### Scenario: Session with partially logged exercises

- GIVEN an authenticated user has a workout session whose routine currently
  has 4 exercises
- AND the user has logged 2 of those exercises for that session
- WHEN the client sends `GET /workout-sessions`
- THEN the response `data` item for that session includes
  `loggedExerciseCount: 2` and `totalExerciseCount: 4`

#### Scenario: Session with no exercises logged yet

- GIVEN an authenticated user has a workout session with no logged exercises
- AND the session's routine currently has 5 exercises
- WHEN the client sends `GET /workout-sessions`
- THEN the response `data` item includes `loggedExerciseCount: 0`
- AND `totalExerciseCount: 5` (the routine's current exercise count)

#### Scenario: Logged count exceeds current planned count after a routine edit

- GIVEN a workout session for which 6 exercises were logged while its routine
  had 6 exercises at the time
- AND the routine was later edited (full-replace) down to 3 exercises
- WHEN the client sends `GET /workout-sessions`
- THEN the response `data` item includes `loggedExerciseCount: 6` and
  `totalExerciseCount: 3`
- AND the system does NOT clamp `loggedExerciseCount` to `totalExerciseCount`
  and does NOT return an error
