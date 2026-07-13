import { ValidationException } from '@domain/exceptions/domain.exception';

export type RoutineExerciseBounds = {
  targetSets: number;
  targetReps: number;
  targetWeightGrams: number;
};

// Shared by create-routine and update-routine — a real business invariant
// re-checked in the use case, not just DTO shape validation, per AGENTS.md's
// symmetric-validation principle (a use case can be invoked directly,
// bypassing the DTO).
export function assertRoutineExerciseBounds(
  exercise: RoutineExerciseBounds,
): void {
  if (exercise.targetSets < 1)
    throw new ValidationException('targetSets must be at least 1');
  if (exercise.targetReps < 1)
    throw new ValidationException('targetReps must be at least 1');
  if (exercise.targetWeightGrams < 0)
    throw new ValidationException('targetWeightGrams must be at least 0');
}
