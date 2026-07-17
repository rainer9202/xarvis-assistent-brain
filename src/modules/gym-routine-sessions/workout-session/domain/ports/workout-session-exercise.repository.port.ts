import { WorkoutSessionExerciseEntity } from '../entities/workout-session-exercise.entity';

// Raw joined row for one logged entry across a user's sessions for a given
// exercise. Deliberately NOT the progress-response shape — the use case maps
// it — so the sibling add-exercise-personal-records change can reuse this
// same method verbatim for its own aggregation (design.md ADR-2).
export type LoggedExerciseEntry = {
  sessionId: string;
  sessionDate: Date;
  routineId: string;
  routineName: string;
  actualSets: number;
  actualReps: number;
  actualWeightGrams: number;
};

// A genuinely independent repository, unlike RoutineExercise which has no
// port at all — WorkoutSessionExercise has its own CRUD endpoints (see
// AGENTS.md "cada ejercicio por separado" design decision).
export interface WorkoutSessionExerciseRepositoryPort {
  // No userId param here — this table has no userId column of its own.
  // Ownership is checked one level up via the parent WorkoutSession's
  // userId; the use case fetches the parent session first to authorize,
  // then operates on this repository.
  findById(id: string): Promise<WorkoutSessionExerciseEntity | null>;
  save(
    entity: WorkoutSessionExerciseEntity,
  ): Promise<WorkoutSessionExerciseEntity>;
  update(
    entity: WorkoutSessionExerciseEntity,
  ): Promise<WorkoutSessionExerciseEntity>;
  delete(entity: WorkoutSessionExerciseEntity): Promise<void>;
  // Ownership IS scoped here (unlike the methods above) via the parent
  // WorkoutSession.userId — this method is used directly by a use case that
  // has already gated exercise visibility, so it must not leak another
  // user's logged rows for the same exerciseId (design.md ADR-4).
  findLoggedEntriesForExercise(
    exerciseId: string,
    userId: string,
  ): Promise<LoggedExerciseEntry[]>;
}

export const WORKOUT_SESSION_EXERCISE_REPOSITORY = Symbol(
  'WorkoutSessionExerciseRepositoryPort',
);
