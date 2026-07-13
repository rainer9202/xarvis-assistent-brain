import { Inject, Injectable } from '@nestjs/common';
import { DomainException } from '@domain/exceptions/domain.exception';
import { GetAllRoutinesUseCase } from '@modules/gym-routine-sessions/routine/application/use-cases/get-all-routines.use-case';
import { WORKOUT_SESSION_REPOSITORY } from '../../domain/ports/workout-session.repository.port';
import type { WorkoutSessionRepositoryPort } from '../../domain/ports/workout-session.repository.port';

export type GetAllWorkoutSessionsResponse = {
  id: string;
  routineId: string;
  routineName: string;
  date: Date;
  finishedAt?: Date | null;
  createdAt: Date;
};

@Injectable()
export class GetAllWorkoutSessionsUseCase {
  constructor(
    @Inject(WORKOUT_SESSION_REPOSITORY)
    private readonly repository: WorkoutSessionRepositoryPort,
    private readonly getAllRoutines: GetAllRoutinesUseCase,
  ) {}

  async execute(userId: string): Promise<GetAllWorkoutSessionsResponse[]> {
    try {
      // Fetched once here (not per session) to avoid an N+1 query — same
      // batched-Map pattern as GetAllMovementsUseCase/GetRoutineByIdUseCase.
      const [entities, routines] = await Promise.all([
        this.repository.findAll(userId),
        this.getAllRoutines.execute(userId),
      ]);
      const routineNameById = new Map(routines.map((r) => [r.id, r.name]));

      return entities.map((item) => ({
        id: item.id!,
        routineId: item.routineId,
        routineName: routineNameById.get(item.routineId) ?? item.routineId,
        date: item.date,
        finishedAt: item.finishedAt,
        createdAt: item.createdAt!,
      }));
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error fetching workout sessions: ${error}`);
    }
  }
}
