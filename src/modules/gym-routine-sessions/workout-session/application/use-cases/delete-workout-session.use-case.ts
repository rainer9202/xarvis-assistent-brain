import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  NotFoundException,
} from '@domain/exceptions/domain.exception';
import { WORKOUT_SESSION_REPOSITORY } from '../../domain/ports/workout-session.repository.port';
import type { WorkoutSessionRepositoryPort } from '../../domain/ports/workout-session.repository.port';

export type DeleteWorkoutSessionResponse = {
  id: string;
};

export class DeleteWorkoutSessionCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}

@Injectable()
export class DeleteWorkoutSessionUseCase {
  constructor(
    @Inject(WORKOUT_SESSION_REPOSITORY)
    private readonly repository: WorkoutSessionRepositoryPort,
  ) {}

  async execute(
    command: DeleteWorkoutSessionCommand,
  ): Promise<DeleteWorkoutSessionResponse> {
    try {
      const session = await this.repository.findById(
        command.id,
        command.userId,
      );
      if (!session)
        throw new NotFoundException(
          `Workout session "${command.id}" not found`,
        );

      // No referential guard needed — nothing else references
      // WorkoutSession, and its WorkoutSessionExercise children cascade
      // -delete automatically via the Prisma onDelete: Cascade relation,
      // same as Movement's no-guard delete.
      await this.repository.delete(session);

      return { id: command.id };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error deleting workout session: ${error}`);
    }
  }
}
