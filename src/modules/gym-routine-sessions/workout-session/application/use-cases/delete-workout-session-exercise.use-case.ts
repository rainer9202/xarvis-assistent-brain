import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  NotFoundException,
} from '@domain/exceptions/domain.exception';
import { WORKOUT_SESSION_REPOSITORY } from '../../domain/ports/workout-session.repository.port';
import type { WorkoutSessionRepositoryPort } from '../../domain/ports/workout-session.repository.port';
import { WORKOUT_SESSION_EXERCISE_REPOSITORY } from '../../domain/ports/workout-session-exercise.repository.port';
import type { WorkoutSessionExerciseRepositoryPort } from '../../domain/ports/workout-session-exercise.repository.port';

export type DeleteWorkoutSessionExerciseResponse = {
  id: string;
};

export class DeleteWorkoutSessionExerciseCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}

@Injectable()
export class DeleteWorkoutSessionExerciseUseCase {
  constructor(
    @Inject(WORKOUT_SESSION_REPOSITORY)
    private readonly sessionRepository: WorkoutSessionRepositoryPort,
    @Inject(WORKOUT_SESSION_EXERCISE_REPOSITORY)
    private readonly repository: WorkoutSessionExerciseRepositoryPort,
  ) {}

  async execute(
    command: DeleteWorkoutSessionExerciseCommand,
  ): Promise<DeleteWorkoutSessionExerciseResponse> {
    try {
      const entry = await this.repository.findById(command.id);
      if (!entry)
        throw new NotFoundException(
          `Workout session exercise "${command.id}" not found`,
        );

      const session = await this.sessionRepository.findById(
        entry.workoutSessionId,
        command.userId,
      );
      if (!session)
        throw new NotFoundException(
          `Workout session exercise "${command.id}" not found`,
        );

      await this.repository.delete(entry);

      return { id: command.id };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(
        `Unexpected error deleting workout session exercise: ${error}`,
      );
    }
  }
}
