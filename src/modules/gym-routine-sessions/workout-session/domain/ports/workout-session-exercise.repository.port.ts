import { WorkoutSessionExerciseEntity } from '../entities/workout-session-exercise.entity';

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
}

export const WORKOUT_SESSION_EXERCISE_REPOSITORY = Symbol(
  'WorkoutSessionExerciseRepositoryPort',
);
