# Archive Report: add-exercise-personal-records

**Status**: COMPLETE
**Archive Date**: 2026-07-17
**Change**: Exercise Max-Weight Personal Records (`GET /workout-sessions/exercises/records`)

## Summary

The `add-exercise-personal-records` change implements a new read endpoint returning an authenticated user's max-weight personal record for every exercise with logged history, resolved in a fixed number of queries (no N+1, no per-exercise loop). All SDD phases completed and verified clean (0 CRITICAL, 1 non-blocking WARNING about e2e test coverage depth for the cross-user isolation scenario using shared exercises).

## Verification Results

**Verdict**: PASS WITH WARNINGS (independent fresh-context review, 2026-07-17)

- **Build/Test Evidence**: 
  - `pnpm typecheck` → 0 errors
  - `pnpm lint` → 0 errors in changed files
  - `pnpm test` → 445 suites / 445 tests passed (includes 2 new spec files: `prisma-workout-session-exercise.repository.spec.ts` `findPersonalRecords` block + `get-personal-records.use-case.spec.ts`)
  - `pnpm test:e2e` → 123/123 passed (includes all 5 new personal-records scenarios in `workout-session.e2e-spec.ts`)

- **Spec Compliance**: All 4 scenarios in the exercise spec delta verified:
  - Records across multiple exercises (one entry per logged exercise, correct max, source session, fixed queries) ✓
  - Tie on max weight resolves to earliest session ✓
  - Exercise with zero logged history is absent ✓
  - User with no logged history at all → 200 + [] ✓

- **Design Adherence**: All 4 ADRs confirmed in code:
  - ADR-1: Route lives in workout-session module (`GET /workout-sessions/exercises/records`, 2 segments, no collision with 3-segment progress route)
  - ADR-2: Two fixed queries (`groupBy` _max + single `findMany` with userId re-scope); unit test asserts exactly two Prisma calls, no N+1
  - ADR-3: Tie-break via explicit has-guard Map (first-in-asc-order = earliest date = PR), not bare `.set()` which would produce latest-wins
  - ADR-4: Own `PersonalRecordEntry[]` type with 7 fields; includes `exerciseName` for frontend convenience

- **Completeness**: All 15 tasks marked done and genuinely completed (not just checked):
  - Phase 1 (1.1–1.3): Port type + method, RED/GREEN repository test, implementation
  - Phase 2 (2.1–2.2): RED/GREEN use case test (3 scenarios), implementation
  - Phase 3 (3.1–3.7): Controller, module wiring, 5 e2e scenarios
  - Phase 4 (4.1–4.3): typecheck, lint, unit + e2e verification

## Artifact Locations

- **Change folder (original)**: `openspec/changes/add-exercise-personal-records/` — removed after archival
- **Archive folder**: `openspec/changes/archive/2026-07-17-add-exercise-personal-records/`
  - `proposal.md` — intent, scope, approach, risks (all success criteria now checked)
  - `design.md` — architecture decisions (ADRs 1–4), integration points, test surfaces
  - `tasks.md` — phase breakdown, work units, verification commands (all tasks checked)
  - `specs/exercise/spec.md` — delta spec "Exercise Max-Weight Personal Records" (ADDED requirements, 4 scenarios)
- **Main spec (merged)**: `openspec/specs/exercise/spec.md`
  - Delta spec requirement merged as the inaugural spec for the exercise domain (no prior SDD-tracked changes existed for exercise)
- **Verification Report**: Engram topic_key `sdd/add-exercise-personal-records/verify-report` (observation ID #108, independent fresh-context review, all evidence captured)

## Non-blocking Notes

**WARNING** (Not Blocking, Suggested Follow-up): The e2e "cross-user isolation" test does NOT reproduce the exact collision scenario at the integration/Postgres level. It uses two different custom exercises at two different weights, which structurally bypasses the userId re-scope concern (Q1's groupBy already scopes to the requesting user's userId, so otherExerciseId never enters their pairs array). The production code IS correct and IS protected by the mocked repository unit test's exact `where`-shape assertion, but the correctness property (userId re-scope in Q2) is not proven against a real Postgres query at the e2e layer. Recommend: add/strengthen one e2e case using a shared/global exercise (seeded with `userId: null`) logged by two different users at the identical weight, asserting the requesting user's entry resolves to their own session only. This is a suggested enhancement to e2e coverage depth, not a defect in production code.

**Discovery**: `Exercise.userId` is nullable — there is a global/seeded exercise catalog alongside per-user custom exercises. Any future cross-user-isolation e2e test for a query keyed on `exerciseId` should deliberately use a shared/global exercise id (not two separate custom per-user exercises) to actually exercise the userId-rescope code path at the database level.

## Commit Pattern

Follows project convention: direct commits to `dev` (no PRs). 3-commit work-unit chain (commits d5f3883/49663de/8b754fb confirmed on dev):
- Commit 1: Foundation (port type + method, repository implementation, unit test)
- Commit 2: Application (use case implementation, unit test)
- Commit 3: Infrastructure (controller, module wiring, e2e scenarios, verification pass)

## Observation IDs (Traceability)

- **Proposal**: sdd/add-exercise-personal-records/proposal (persisted during sdd-propose)
- **Spec**: sdd/add-exercise-personal-records/spec (persisted during sdd-spec)
- **Design**: sdd/add-exercise-personal-records/design (persisted during sdd-design)
- **Tasks**: sdd/add-exercise-personal-records/tasks (persisted during sdd-tasks)
- **Verify Report**: #108 (Engram observation ID)
- **Archive Report**: sdd/add-exercise-personal-records/archive-report (this document, persisted at archive time)
