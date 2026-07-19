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
  loggedExerciseCount: number;
  totalExerciseCount: number;
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
      // GetAllRoutinesUseCase now returns { items, pagination? } (additive
      // pagination support), so we take .items — called unpaginated here,
      // so pagination is always undefined.
      const [items, routinesResult] = await Promise.all([
        this.repository.findAll(userId),
        this.getAllRoutines.execute(userId),
      ]);
      const routineById = new Map(
        routinesResult.items.map((r) => [
          r.id,
          { name: r.name, exerciseCount: r.exerciseCount },
        ]),
      );

      return items.map(({ session, loggedExerciseCount }) => {
        const routine = routineById.get(session.routineId);
        return {
          id: session.id!,
          routineId: session.routineId,
          routineName: routine?.name ?? session.routineId,
          date: session.date,
          finishedAt: session.finishedAt,
          createdAt: session.createdAt!,
          loggedExerciseCount,
          // Routine is guaranteed present whenever any session references it
          // (WorkoutSession.routineId is onDelete: Restrict and
          // DeleteRoutineUseCase blocks deletion while referenced — ADR-2),
          // but the fallback mirrors the existing routineName ?? defensive
          // pattern above for the same defensive reason.
          totalExerciseCount: routine?.exerciseCount ?? 0,
        };
      });
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error fetching workout sessions: ${error}`);
    }
  }
}
