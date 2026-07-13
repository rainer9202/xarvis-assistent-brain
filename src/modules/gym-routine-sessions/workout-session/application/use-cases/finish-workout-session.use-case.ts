import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  NotFoundException,
  ValidationException,
} from '@domain/exceptions/domain.exception';
import { WORKOUT_SESSION_REPOSITORY } from '../../domain/ports/workout-session.repository.port';
import type { WorkoutSessionRepositoryPort } from '../../domain/ports/workout-session.repository.port';

export type FinishWorkoutSessionResponse = {
  id: string;
};

export class FinishWorkoutSessionCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}

// A dedicated use case, not folded into a generic update — mirrors how
// Account.setPrincipal is its own dedicated repository method/flow rather
// than a generic field update, because "finishing" has its own guard logic.
@Injectable()
export class FinishWorkoutSessionUseCase {
  constructor(
    @Inject(WORKOUT_SESSION_REPOSITORY)
    private readonly repository: WorkoutSessionRepositoryPort,
  ) {}

  async execute(
    command: FinishWorkoutSessionCommand,
  ): Promise<FinishWorkoutSessionResponse> {
    try {
      const session = await this.repository.findById(
        command.id,
        command.userId,
      );
      if (!session)
        throw new NotFoundException(
          `Workout session "${command.id}" not found`,
        );

      if (session.finishedAt)
        throw new ValidationException('Workout session is already finished');

      session.finishedAt = new Date();
      const saved = await this.repository.update(session);

      return { id: saved.id! };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error finishing workout session: ${error}`);
    }
  }
}
