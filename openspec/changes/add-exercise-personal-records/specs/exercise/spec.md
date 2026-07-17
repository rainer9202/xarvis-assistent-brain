# Delta for Exercise

## ADDED Requirements

### Requirement: Exercise Max-Weight Personal Records

The system MUST expose a read endpoint that returns the authenticated
user's max-weight personal record for every exercise that has at least
one logged `WorkoutSessionExercise` row, resolved in a fixed number of
queries (no N+1, no per-exercise loop).

(Exact route path/controller placement is a design decision, not fixed
by this spec — the response envelope and field contract below apply
regardless of final path.)

Each item in the response `data` array MUST include exactly these
fields: `exerciseId`, `exerciseName`, `maxWeightGrams`, `sessionId`,
`sessionDate`, `routineId`, `routineName`. `maxWeightGrams` MUST equal
the single highest `actualWeightGrams` value ever logged by the user
for that exercise across all their sessions. `sessionId`, `sessionDate`,
`routineId`, and `routineName` MUST identify the specific session in
which that max was achieved.

A record is MAX WEIGHT LIFTED only — the system MUST NOT compute or
return an e1RM/formula-based value, a best-reps value, or a per-set
value.

When two or more sessions share the same max `actualWeightGrams` for an
exercise, the system MUST resolve the tie deterministically to the
session with the EARLIEST `sessionDate` — the ordering MUST NOT depend
on database row order.

The system MUST scope results to the authenticated user via the parent
`WorkoutSession.userId` — `WorkoutSessionExercise` has no `userId`
column of its own, so ownership MUST NOT be checked directly on that
table.

An exercise with zero logged `WorkoutSessionExercise` history for the
user MUST be absent from the `data` array — never represented as a null
or zero-value entry. A user with no logged history at all MUST receive
`200` with `data: []`, never a `404`.

#### Scenario: Records across multiple exercises

- GIVEN an authenticated user has logged three different exercises,
  each across one or more sessions with varying `actualWeightGrams`
- WHEN the client requests personal records
- THEN the response is `200` with one `data` entry per logged exercise
- AND each entry's `maxWeightGrams` equals that exercise's true highest
  logged `actualWeightGrams` for the user
- AND each entry's `sessionId`/`sessionDate`/`routineId`/`routineName`
  identify the session where that max was actually logged
- AND records are resolved in a fixed number of queries, not one query
  per exercise

#### Scenario: Tie on max weight resolves to earliest session

- GIVEN an authenticated user logged the same exercise at the identical
  highest `actualWeightGrams` in two different sessions on different
  dates
- WHEN the client requests personal records
- THEN the entry for that exercise references the session with the
  EARLIER `sessionDate` of the two tied sessions

#### Scenario: Exercise with zero logged history is absent

- GIVEN an authenticated user has logged history for exercise A but has
  never logged exercise B
- WHEN the client requests personal records
- THEN the response `data` array contains an entry for exercise A
- AND the response `data` array contains NO entry for exercise B —
  neither a null value nor a zero-value placeholder

#### Scenario: User with no logged history at all

- GIVEN an authenticated user has never logged any exercise in any
  workout session
- WHEN the client requests personal records
- THEN the response is `200` with `data: []`
