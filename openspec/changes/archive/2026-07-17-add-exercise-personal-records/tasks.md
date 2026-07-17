# Tasks: Exercise Personal Records (`GET /workout-sessions/exercises/records`)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~220-270 (5 files touched: 3 modified, 2 new; incl. unit + e2e tests) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single work-unit chain (3 commits) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

Rationale: contained to the `workout-session` module, no migration, no new cross-module coupling, and — unlike the progress sibling — no `GetExerciseByIdUseCase` visibility gate is involved (no `:exerciseId` param), which removes a whole class of use-case branches and e2e cases. Smaller than `add-exercise-progress-history`, which itself landed under the 400-line budget.

### Suggested Work Units

| Unit | Goal | Commit | Notes |
|------|------|--------|-------|
| 1 | Foundation (port + repository, two-query groupBy/findMany) | Commit 1 | RED/GREEN pair on `prisma-workout-session-exercise.repository.spec.ts` |
| 2 | Application (use case, tie-break reduce + mapping) | Commit 2 | RED/GREEN pair on `get-personal-records.use-case.spec.ts` |
| 3 | Infrastructure (controller + module wiring) + e2e | Commit 3 | New controller, `workout-session.module.ts` registration, e2e spec |

Delivery: no PRs — work lands as conventional work-unit commits pushed directly to `dev`. Phases below double as commit boundaries: Phase 1 = one commit (port + repository), Phase 2 = one commit (use case), Phase 3 = one commit (controller + module wiring + e2e coverage). Phase 4 is verification only, folded into Phase 3's commit.

## Phase 1: Foundation (Port + Repository)

- [x] 1.1 Add `PersonalRecordEntry` type (`{ exerciseId, exerciseName, maxWeightGrams, sessionId, sessionDate, routineId, routineName }`) and `findPersonalRecords(userId: string): Promise<PersonalRecordEntry[]>` to `WorkoutSessionExerciseRepositoryPort` (`domain/ports/workout-session-exercise.repository.port.ts`) — ADR-4
- [x] 1.2 RED: extend `infrastructure/repositories/prisma-workout-session-exercise.repository.spec.ts` — new `findPersonalRecords` describe block asserting: `groupBy` called with `by: ['exerciseId']`, `where: { workoutSession: { userId } }`, `_max: { actualWeightGrams: true }`; null `_max` results filtered before building pairs; when `groupBy` returns no usable pairs, `findMany` is NOT called and `[]` is returned; otherwise a SINGLE `findMany` is called with `where: { workoutSession: { userId }, OR: pairs }`, the `exercise`/`workoutSession.routine` include, and `orderBy: { workoutSession: { date: 'asc' } }`; asserts mapping to `PersonalRecordEntry[]`; asserts exactly two Prisma calls total (no N+1) — ADR-2
- [x] 1.3 GREEN: implement `findPersonalRecords` in `PrismaWorkoutSessionExerciseRepository` per ADR-2's exact query shape (Q1 `groupBy` + pair-building, early-return `[]` when `pairs.length === 0`, Q2 `findMany` with `userId` re-scoped in the `OR` clause); map each row to `PersonalRecordEntry`

## Phase 2: Application (Use Case)

- [x] 2.1 RED: write `application/use-cases/get-personal-records.use-case.spec.ts` — (a) multiple exercises: repository returns one candidate row per exercise, use case returns one `PersonalRecordEntry` per exercise unchanged; (b) tie on max weight: repository returns two rows for the same `exerciseId` (earliest date first, per ADR-2's `orderBy asc`), use case keeps only the first-seen row and drops the later one; (c) empty repository result (`[]`) → use case returns `[]` — ADR-3
- [x] 2.2 GREEN: create `GetPersonalRecordsUseCase` (`application/use-cases/get-personal-records.use-case.ts`) — constructor-injects `WORKOUT_SESSION_EXERCISE_REPOSITORY`; `execute(userId)` calls `repository.findPersonalRecords(userId)`, then reduces via the explicit has-guard `Map` (`if (!byExercise.has(row.exerciseId)) byExercise.set(...)`) — NOT a plain `.set()` per iteration — keeping the first-seen (earliest-date) row per `exerciseId`, and maps the result to the response array — ADR-3

## Phase 3: Infrastructure (Controller + Wiring) + e2e Verification

- [x] 3.1 Create `ExercisePersonalRecordsController` (`infrastructure/controllers/exercise-personal-records.controller.ts`) — `@Controller('workout-sessions')`, `@Get('exercises/records')` handler calling `GetPersonalRecordsUseCase.execute` with `@CurrentUser()` id; returns `{ message, data }` — ADR-1
- [x] 3.2 Register `GetPersonalRecordsUseCase` provider and `ExercisePersonalRecordsController` in `workout-session.module.ts` (no new module import required — no cross-module use case is involved)
- [x] 3.3 In `test/gym-routine-sessions/workout-session.e2e-spec.ts` (or a personal-records-specific e2e file), add: log three different exercises across one or more sessions with varying `actualWeightGrams` → `GET /workout-sessions/exercises/records` → 200, one `data` entry per logged exercise, each entry's `maxWeightGrams` equals that exercise's true highest logged value and `sessionId`/`sessionDate`/`routineId`/`routineName` identify the session where that max was logged (spec scenario "Records across multiple exercises")
- [x] 3.4 Add: log the same exercise at the identical highest `actualWeightGrams` in two sessions on different dates → the entry for that exercise references the session with the EARLIER `sessionDate` of the two tied sessions (spec scenario "Tie on max weight resolves to earliest session")
- [x] 3.5 Add: log history for exercise A only, never log exercise B → `data` contains an entry for A and NO entry for B (no null, no zero-value placeholder) (spec scenario "Exercise with zero logged history is absent")
- [x] 3.6 Add: user with no logged history at all → 200, `data: []`, never 404 (spec scenario "User with no logged history at all")
- [x] 3.7 Add: cross-user isolation — another user's heavier logged lift for the same exercise never appears in the requesting user's `data` entry (design Test Surfaces §4, ownership scoped via `WorkoutSession.userId`)

## Phase 4: Verification Commands

- [x] 4.1 Run `pnpm typecheck` and `pnpm lint` — both clean
- [x] 4.2 Run `pnpm test` (unit) — all suites pass, including new `findPersonalRecords` cases in `prisma-workout-session-exercise.repository.spec.ts` and `get-personal-records.use-case.spec.ts`
- [x] 4.3 Run `pnpm test:e2e` against the docker-compose `db` service — all 5 new Phase 3 scenarios pass
