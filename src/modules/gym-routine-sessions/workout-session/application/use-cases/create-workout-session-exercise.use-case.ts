import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  NotFoundException,
  ValidationException,
} from '@domain/exceptions/domain.exception';
import { GetExerciseByIdUseCase } from '@modules/gym-routine-sessions/exercise/application/use-cases/get-exercise-by-id.use-case';
import { WorkoutSessionExerciseEntity } from '../../domain/entities/workout-session-exercise.entity';
import { WORKOUT_SESSION_REPOSITORY } from '../../domain/ports/workout-session.repository.port';
import type { WorkoutSessionRepositoryPort } from '../../domain/ports/workout-session.repository.port';
import { WORKOUT_SESSION_EXERCISE_REPOSITORY } from '../../domain/ports/workout-session-exercise.repository.port';
import type { WorkoutSessionExerciseRepositoryPort } from '../../domain/ports/workout-session-exercise.repository.port';
import { assertWorkoutSessionExerciseBounds } from '../shared/assert-workout-session-exercise-bounds';

export type CreateWorkoutSessionExerciseResponse = {
  id: string;
};

export class CreateWorkoutSessionExerciseCommand {
  constructor(
    public readonly workoutSessionId: string,
    public readonly userId: string,
    public readonly exerciseId: string,
    public readonly actualSets: number,
    public readonly actualReps: number,
    public readonly actualWeightGrams: number,
  ) {}
}

@Injectable()
export class CreateWorkoutSessionExerciseUseCase {
  constructor(
    // Same-feature repository, injected directly — WorkoutSession and
    // WorkoutSessionExercise live in the same feature module, so this isn't
    // a cross-module access (which would require an exported use case).
    @Inject(WORKOUT_SESSION_REPOSITORY)
    private readonly sessionRepository: WorkoutSessionRepositoryPort,
    @Inject(WORKOUT_SESSION_EXERCISE_REPOSITORY)
    private readonly repository: WorkoutSessionExerciseRepositoryPort,
    private readonly getExerciseById: GetExerciseByIdUseCase,
  ) {}

  async execute(
    command: CreateWorkoutSessionExerciseCommand,
  ): Promise<CreateWorkoutSessionExerciseResponse> {
    try {
      // Independent lookups — run in parallel rather than as two sequential
      // round-trips. Propagates NotFoundException from GetExerciseByIdUseCase
      // when the exerciseId doesn't exist or isn't visible to this user.
      const [session] = await Promise.all([
        this.sessionRepository.findById(
          command.workoutSessionId,
          command.userId,
        ),
        this.getExerciseById.execute(command.exerciseId, command.userId),
      ]);
      if (!session)
        throw new NotFoundException(
          `Workout session "${command.workoutSessionId}" not found`,
        );

      if (session.finishedAt)
        throw new ValidationException(
          'Cannot log an exercise on a finished workout session',
        );

      assertWorkoutSessionExerciseBounds(command);

      const entity = new WorkoutSessionExerciseEntity({
        workoutSessionId: command.workoutSessionId,
        exerciseId: command.exerciseId,
        actualSets: command.actualSets,
        actualReps: command.actualReps,
        actualWeightGrams: command.actualWeightGrams,
      });
      const saved = await this.repository.save(entity);

      return { id: saved.id! };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(
        `Unexpected error creating workout session exercise: ${error}`,
      );
    }
  }
}
