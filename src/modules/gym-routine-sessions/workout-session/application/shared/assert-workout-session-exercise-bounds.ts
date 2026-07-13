import { ValidationException } from '@domain/exceptions/domain.exception';

export type WorkoutSessionExerciseBounds = {
  actualSets: number;
  actualReps: number;
  actualWeightGrams: number;
};

// Shared by create/update-workout-session-exercise — a real business
// invariant re-checked in the use case, not just DTO shape validation, per
// AGENTS.md's symmetric-validation principle.
export function assertWorkoutSessionExerciseBounds(
  values: WorkoutSessionExerciseBounds,
): void {
  if (values.actualSets < 1)
    throw new ValidationException('actualSets must be at least 1');
  if (values.actualReps < 1)
    throw new ValidationException('actualReps must be at least 1');
  if (values.actualWeightGrams < 0)
    throw new ValidationException('actualWeightGrams must be at least 0');
}
