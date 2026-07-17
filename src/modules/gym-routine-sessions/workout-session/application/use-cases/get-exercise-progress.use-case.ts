import { Inject, Injectable } from '@nestjs/common';
import { DomainException } from '@domain/exceptions/domain.exception';
import { GetExerciseByIdUseCase } from '@modules/gym-routine-sessions/exercise/application/use-cases/get-exercise-by-id.use-case';
import { WORKOUT_SESSION_EXERCISE_REPOSITORY } from '../../domain/ports/workout-session-exercise.repository.port';
import type { WorkoutSessionExerciseRepositoryPort } from '../../domain/ports/workout-session-exercise.repository.port';

export type ExerciseProgressEntry = {
  sessionId: string;
  sessionDate: Date;
  routineId: string;
  routineName: string;
  actualSets: number;
  actualReps: number;
  actualWeightGrams: number;
};

@Injectable()
export class GetExerciseProgressUseCase {
  constructor(
    private readonly getExerciseById: GetExerciseByIdUseCase,
    @Inject(WORKOUT_SESSION_EXERCISE_REPOSITORY)
    private readonly repository: WorkoutSessionExerciseRepositoryPort,
  ) {}

  async execute(
    exerciseId: string,
    userId: string,
  ): Promise<ExerciseProgressEntry[]> {
    try {
      // Visibility gate FIRST — throws NotFoundException for a nonexistent
      // id or another user's custom exercise, indistinguishably (design.md
      // ADR-3). Only once the exercise is confirmed visible do we query the
      // logged entries, which are legitimately [] for a never-logged
      // exercise.
      await this.getExerciseById.execute(exerciseId, userId);

      const entries = await this.repository.findLoggedEntriesForExercise(
        exerciseId,
        userId,
      );

      return entries.map((entry) => ({
        sessionId: entry.sessionId,
        sessionDate: entry.sessionDate,
        routineId: entry.routineId,
        routineName: entry.routineName,
        actualSets: entry.actualSets,
        actualReps: entry.actualReps,
        actualWeightGrams: entry.actualWeightGrams,
      }));
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error fetching exercise progress: ${error}`);
    }
  }
}
