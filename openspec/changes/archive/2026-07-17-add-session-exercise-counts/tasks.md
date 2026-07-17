# Tasks: Session List Exercise Counts (`loggedExerciseCount` / `totalExerciseCount`)

Delivery: no PRs — work lands as conventional work-unit commits pushed
directly to `dev`. Phases below double as commit boundaries: Phase 1 = one
commit (port + repository), Phase 2 = one commit (use case), Phase 3 = one
commit (e2e coverage). Controller, DTO, entity, and `workout-session.module.ts`
are unchanged (design ADR-4) — no infrastructure-layer commit needed.

## Phase 1: Foundation (Port + Repository)

- [x] 1.1 Grep-verify `WorkoutSessionRepositoryPort.findAll` still has exactly
      one caller (`get-all-workout-sessions.use-case.ts`) before widening its
      return type — `rg "repository\.findAll\(userId\)" src/modules/gym-routine-sessions/workout-session`.
      If any other caller appears, stop and update this task list first.
- [x] 1.2 Add `WorkoutSessionWithLoggedCount` type (`{ session: WorkoutSessionEntity; loggedExerciseCount: number }`)
      to `domain/ports/workout-session.repository.port.ts`; change `findAll`
      signature to `Promise<WorkoutSessionWithLoggedCount[]>` — ADR-1
- [x] 1.3 RED: extend `infrastructure/repositories/prisma-workout-session.repository.spec.ts`
      `findAll` describe block — asserts `workoutSession.findMany` is called
      with `include: { _count: { select: { exercises: true } } }` (in addition
      to existing `where`/`orderBy`); asserts each result item is
      `{ session: WorkoutSessionEntity, loggedExerciseCount }` mapped from
      `record._count.exercises`; asserts `findMany` is called exactly once
      (no per-session count query — no N+1)
- [x] 1.4 GREEN: update `PrismaWorkoutSessionRepository.findAll` — add the
      `_count` include, return `{ session: this.toEntity(r), loggedExerciseCount: r._count.exercises }[]`

## Phase 2: Application (Use Case)

- [x] 2.1 RED: update `application/use-cases/get-all-workout-sessions.use-case.spec.ts`
      — change the `findAll` mock to resolve `{ session, loggedExerciseCount }[]`
      and widen the `getAllRoutines` mock to include `exerciseCount`. Add
      scenarios: (a) partially logged — logged 2, routine has 4 →
      `loggedExerciseCount: 2, totalExerciseCount: 4` (spec scenario 1);
      (b) none logged — logged 0, routine has 5 →
      `loggedExerciseCount: 0, totalExerciseCount: 5` (spec scenario 2);
      (c) **exceeds-planned edge** — logged 6, routine currently has 3 →
      `loggedExerciseCount: 6, totalExerciseCount: 3` returned as-is, no
      clamping, no thrown error (spec scenario 3, ADR-2 consequence — this
      MUST be its own explicit assertion, not just implied by other cases);
      (d) routine missing from the routines list → `totalExerciseCount: 0`
      fallback; (e) all pre-existing fields (`id`, `routineId`, `routineName`,
      `date`, `finishedAt`, `createdAt`) still mapped unchanged
- [x] 2.2 GREEN: update `GetAllWorkoutSessionsUseCase` — widen
      `routineNameById` to a `routineById` Map of
      `id → { name, exerciseCount }`; destructure `{ session, loggedExerciseCount }`
      per item; add `loggedExerciseCount: number` and
      `totalExerciseCount: number` to `GetAllWorkoutSessionsResponse` and the
      mapped return, with `totalExerciseCount` falling back to `0` when the
      routine is absent from the Map — ADR-2, ADR-4

## Phase 3: e2e Verification (real docker-compose Postgres)

- [x] 3.1 In `test/gym-routine-sessions/workout-session.e2e-spec.ts`, add: create
      a routine with 4 exercises → create a session → log 2 of them →
      `GET /workout-sessions` → asserts `loggedExerciseCount: 2`,
      `totalExerciseCount: 4`, and all other existing fields unchanged (spec
      scenario 1)
- [x] 3.2 Add: create a session with 0 logged exercises whose routine has 5 →
      `GET /workout-sessions` → asserts `loggedExerciseCount: 0`,
      `totalExerciseCount: 5` (spec scenario 2)
- [x] 3.3 Add: log 6 exercises against a session while its routine has 6, then
      full-replace-edit the routine down to 3 exercises →
      `GET /workout-sessions` → asserts `loggedExerciseCount: 6`,
      `totalExerciseCount: 3`, response is 200 (no clamping, no error) — spec
      scenario 3 / ADR-2 consequence, e2e-level confirmation of the unit-level
      edge case from 2.1(c)

## Phase 4: Verification Commands

- [x] 4.1 Run `pnpm typecheck` and `pnpm lint` — both clean (0 lint errors;
      remaining lint warnings are pre-existing `no-unsafe-argument` noise in
      unrelated e2e specs, not introduced by this change)
- [x] 4.2 Run `pnpm test` (unit) — all 434 tests pass (73 suites), including
      new `prisma-workout-session.repository.spec.ts` and
      `get-all-workout-sessions.use-case.spec.ts` cases
- [x] 4.3 Run `pnpm test:e2e` against a local Postgres (podman container,
      docker CLI unavailable in this environment) — all 114 tests pass
      (11 suites), including the 3 new Phase 3 scenarios
