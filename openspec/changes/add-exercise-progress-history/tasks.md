# Tasks: Per-Exercise Progress History (`GET /workout-sessions/exercises/:exerciseId/progress`)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~280-340 (5 files touched: 3 modified, 2 new; incl. unit + e2e tests) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single work-unit chain (3 commits) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

Rationale: change is contained to the `workout-session` module, no migration, no new cross-module coupling (`ExerciseModule` already imported). Mirrors `add-session-exercise-counts` in shape and size, which landed well under the 400-line budget.

### Suggested Work Units

| Unit | Goal | Commit | Notes |
|------|------|--------|-------|
| 1 | Foundation (port + repository, joined query) | Commit 1 | RED/GREEN pair on `prisma-workout-session-exercise.repository.spec.ts` |
| 2 | Application (use case, visibility gate + mapping) | Commit 2 | RED/GREEN pair on `get-exercise-progress.use-case.spec.ts` |
| 3 | Infrastructure (controller + module wiring) + e2e | Commit 3 | New controller, `workout-session.module.ts` registration, e2e spec |

Delivery: no PRs — work lands as conventional work-unit commits pushed directly to `dev`. Phases below double as commit boundaries: Phase 1 = one commit (port + repository), Phase 2 = one commit (use case), Phase 3 = one commit (controller + module wiring + e2e coverage). Phase 4 is verification only, folded into Phase 3's commit.

## Phase 1: Foundation (Port + Repository)

- [x] 1.1 Add `LoggedExerciseEntry` type (`{ sessionId, sessionDate, routineId, routineName, actualSets, actualReps, actualWeightGrams }`) and `findLoggedEntriesForExercise(exerciseId: string, userId: string): Promise<LoggedExerciseEntry[]>` to `WorkoutSessionExerciseRepositoryPort` (`domain/ports/workout-session-exercise.repository.port.ts`) — ADR-2
- [x] 1.2 RED: extend `infrastructure/repositories/prisma-workout-session-exercise.repository.spec.ts` — new `findLoggedEntriesForExercise` describe block asserting `findMany` is called with `where: { exerciseId, workoutSession: { userId } }`, `include.workoutSession.routine` select, and `orderBy: { workoutSession: { date: 'asc' } }`; asserts mapping to `LoggedExerciseEntry[]`; asserts exactly ONE `findMany` call (no N+1) — ADR-4
- [x] 1.3 GREEN: implement `findLoggedEntriesForExercise` in `PrismaWorkoutSessionExerciseRepository` per ADR-4's query shape; map each row to `LoggedExerciseEntry`

## Phase 2: Application (Use Case)

- [ ] 2.1 RED: write `application/use-cases/get-exercise-progress.use-case.spec.ts` — (a) logged-across-sessions: `getExerciseById` resolves, entries mapped and returned ordered asc; (b) visible-but-never-logged: `getExerciseById` resolves, `findLoggedEntriesForExercise` returns `[]` → use case returns `[]`; (c) `getExerciseById` throws `NotFoundException` → propagates, `findLoggedEntriesForExercise` is NOT called — ADR-3
- [ ] 2.2 GREEN: create `GetExerciseProgressUseCase` (`application/use-cases/get-exercise-progress.use-case.ts`) — constructor-injects `GetExerciseByIdUseCase` and `WORKOUT_SESSION_EXERCISE_REPOSITORY`; `execute(exerciseId, userId)` calls `getExerciseById.execute(exerciseId, userId)` first (gate), then `repository.findLoggedEntriesForExercise(exerciseId, userId)`, mapping to `ExerciseProgressEntry[]` — ADR-6

## Phase 3: Infrastructure (Controller + Wiring) + e2e Verification

- [ ] 3.1 Create `ExerciseProgressController` (`infrastructure/controllers/exercise-progress.controller.ts`) — `@Controller('workout-sessions')`, `@Get('exercises/:exerciseId/progress')` handler calling `GetExerciseProgressUseCase.execute` with `@Param('exerciseId')` and `@CurrentUser()` id; returns `{ message, data }` — ADR-1
- [ ] 3.2 Register `GetExerciseProgressUseCase` provider and `ExerciseProgressController` in `workout-session.module.ts` (`imports: [ExerciseModule]` already present, no change needed there)
- [ ] 3.3 In `test/gym-routine-sessions/workout-session.e2e-spec.ts` (or exercise-progress-specific e2e file), add: log one exercise across 2+ sessions on different dates → `GET /workout-sessions/exercises/:exerciseId/progress` → 200, `data` ordered by `sessionDate` asc, each entry has the six required fields matching logged rows (spec scenario "Exercise logged across multiple sessions")
- [ ] 3.4 Add: visible exercise (global catalog or own custom) never logged → 200, `data: []` (spec scenario "Exercise visible but never logged")
- [ ] 3.5 Add: nonexistent `exerciseId` → 404 (spec scenario "Exercise does not exist")
- [ ] 3.6 Add: another user's custom `exerciseId` → 404, response body shape indistinguishable from the nonexistent-id case (spec scenario "Exercise belongs to another user's custom exercise")

## Phase 4: Verification Commands

- [ ] 4.1 Run `pnpm typecheck` and `pnpm lint` — both clean
- [ ] 4.2 Run `pnpm test` (unit) — all suites pass, including new `prisma-workout-session-exercise.repository.spec.ts` and `get-exercise-progress.use-case.spec.ts` cases
- [ ] 4.3 Run `pnpm test:e2e` against the docker-compose `db` service — all 4 new Phase 3 scenarios pass
