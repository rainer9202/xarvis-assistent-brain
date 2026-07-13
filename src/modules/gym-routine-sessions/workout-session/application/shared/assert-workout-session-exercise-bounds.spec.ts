import { ValidationException } from '@domain/exceptions/domain.exception';
import { assertWorkoutSessionExerciseBounds } from './assert-workout-session-exercise-bounds';

describe('assertWorkoutSessionExerciseBounds', () => {
  it('passes for valid bounds, including actualWeightGrams: 0', () => {
    expect(() =>
      assertWorkoutSessionExerciseBounds({
        actualSets: 1,
        actualReps: 1,
        actualWeightGrams: 0,
      }),
    ).not.toThrow();
  });

  it('throws when actualSets is below 1', () => {
    expect(() =>
      assertWorkoutSessionExerciseBounds({
        actualSets: 0,
        actualReps: 1,
        actualWeightGrams: 0,
      }),
    ).toThrow(ValidationException);
  });

  it('throws when actualReps is below 1', () => {
    expect(() =>
      assertWorkoutSessionExerciseBounds({
        actualSets: 1,
        actualReps: 0,
        actualWeightGrams: 0,
      }),
    ).toThrow(ValidationException);
  });

  it('throws when actualWeightGrams is negative', () => {
    expect(() =>
      assertWorkoutSessionExerciseBounds({
        actualSets: 1,
        actualReps: 1,
        actualWeightGrams: -1,
      }),
    ).toThrow(ValidationException);
  });
});
