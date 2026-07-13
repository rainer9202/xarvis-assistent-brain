import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  NotFoundException,
  ValidationException,
} from '@domain/exceptions/domain.exception';
import { EXERCISE_REPOSITORY } from '../../domain/ports/exercise.repository.port';
import type { ExerciseRepositoryPort } from '../../domain/ports/exercise.repository.port';

export type DeleteExerciseResponse = {
  id: string;
};

export class DeleteExerciseCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}

@Injectable()
export class DeleteExerciseUseCase {
  constructor(
    @Inject(EXERCISE_REPOSITORY)
    private readonly repository: ExerciseRepositoryPort,
  ) {}

  async execute(
    command: DeleteExerciseCommand,
  ): Promise<DeleteExerciseResponse> {
    try {
      const exercise = await this.repository.findOwnById(
        command.id,
        command.userId,
      );
      if (!exercise)
        throw new NotFoundException(`Exercise "${command.id}" not found`);

      const [referencingRoutines, referencingSessions] = await Promise.all([
        this.repository.countRoutineExercisesByExerciseId(command.id),
        this.repository.countSessionExercisesByExerciseId(command.id),
      ]);
      if (referencingRoutines > 0 || referencingSessions > 0)
        throw new ValidationException(
          'Exercise cannot be deleted because it is referenced by existing routines or workout sessions',
        );

      await this.repository.delete(exercise);

      return { id: command.id };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error deleting exercise: ${error}`);
    }
  }
}
