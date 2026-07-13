import { Inject, Injectable } from '@nestjs/common';
import { DomainException } from '@domain/exceptions/domain.exception';
import { GetRoutineByIdUseCase } from '@modules/gym-routine-sessions/routine/application/use-cases/get-routine-by-id.use-case';
import { WorkoutSessionEntity } from '../../domain/entities/workout-session.entity';
import { WORKOUT_SESSION_REPOSITORY } from '../../domain/ports/workout-session.repository.port';
import type { WorkoutSessionRepositoryPort } from '../../domain/ports/workout-session.repository.port';

export type CreateWorkoutSessionResponse = {
  id: string;
};

export class CreateWorkoutSessionCommand {
  constructor(
    public readonly userId: string,
    public readonly routineId: string,
    public readonly date: Date,
  ) {}
}

@Injectable()
export class CreateWorkoutSessionUseCase {
  constructor(
    @Inject(WORKOUT_SESSION_REPOSITORY)
    private readonly repository: WorkoutSessionRepositoryPort,
    private readonly getRoutineById: GetRoutineByIdUseCase,
  ) {}

  async execute(
    command: CreateWorkoutSessionCommand,
  ): Promise<CreateWorkoutSessionResponse> {
    try {
      // Propagates NotFoundException from GetRoutineByIdUseCase when the
      // routineId doesn't exist or doesn't belong to this user.
      await this.getRoutineById.execute(command.routineId, command.userId);

      const entity = new WorkoutSessionEntity({
        userId: command.userId,
        routineId: command.routineId,
        date: command.date,
        finishedAt: null,
      });
      const saved = await this.repository.save(entity);

      return { id: saved.id! };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error creating workout session: ${error}`);
    }
  }
}
