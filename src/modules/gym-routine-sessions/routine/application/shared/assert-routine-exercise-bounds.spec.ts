import { ValidationException } from '@domain/exceptions/domain.exception';
import { assertRoutineExerciseBounds } from './assert-routine-exercise-bounds';

describe('assertRoutineExerciseBounds', () => {
  it('passes for valid bounds, including targetWeightGrams: 0 for bodyweight exercises', () => {
    expect(() =>
      assertRoutineExerciseBounds({
        targetSets: 1,
        targetReps: 1,
        targetWeightGrams: 0,
      }),
    ).not.toThrow();
  });

  it('throws when targetSets is below 1', () => {
    expect(() =>
      assertRoutineExerciseBounds({
        targetSets: 0,
        targetReps: 1,
        targetWeightGrams: 0,
      }),
    ).toThrow(ValidationException);
  });

  it('throws when targetReps is below 1', () => {
    expect(() =>
      assertRoutineExerciseBounds({
        targetSets: 1,
        targetReps: 0,
        targetWeightGrams: 0,
      }),
    ).toThrow(ValidationException);
  });

  it('throws when targetWeightGrams is negative', () => {
    expect(() =>
      assertRoutineExerciseBounds({
        targetSets: 1,
        targetReps: 1,
        targetWeightGrams: -1,
      }),
    ).toThrow(ValidationException);
  });
});
