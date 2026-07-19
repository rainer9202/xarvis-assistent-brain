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

export type GetAllWorkoutSessionsResult = {
  items: GetAllWorkoutSessionsResponse[];
  pagination?: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasMore: boolean;
  };
};

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

@Injectable()
export class GetAllWorkoutSessionsUseCase {
  constructor(
    @Inject(WORKOUT_SESSION_REPOSITORY)
    private readonly repository: WorkoutSessionRepositoryPort,
    private readonly getAllRoutines: GetAllRoutinesUseCase,
  ) {}

  async execute(
    userId: string,
    page?: number,
    limit?: number,
  ): Promise<GetAllWorkoutSessionsResult> {
    try {
      const isPaginated = page !== undefined || limit !== undefined;
      const effectivePage = page ?? DEFAULT_PAGE;
      const effectiveLimit = limit ?? DEFAULT_LIMIT;

      // Fetched once here (not per session) to avoid an N+1 query — same
      // batched-Map pattern as GetAllMovementsUseCase/GetRoutineByIdUseCase.
      // GetAllRoutinesUseCase now returns { items, pagination? } (additive
      // pagination support), so we take .items — called unpaginated here
      // (this use case's own pagination is independent of the routines
      // lookup, which always needs the full routine list to resolve names).
      const [sessionItems, routinesResult, totalCount] = await Promise.all([
        this.repository.findAll(
          userId,
          isPaginated ? effectivePage : undefined,
          isPaginated ? effectiveLimit : undefined,
        ),
        this.getAllRoutines.execute(userId),
        isPaginated
          ? this.repository.countByUserId(userId)
          : Promise.resolve(undefined),
      ]);
      const routineById = new Map(
        routinesResult.items.map((r) => [
          r.id,
          { name: r.name, exerciseCount: r.exerciseCount },
        ]),
      );

      const items = sessionItems.map(({ session, loggedExerciseCount }) => {
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

      if (!isPaginated || totalCount === undefined) {
        return { items };
      }

      return {
        items,
        pagination: {
          page: effectivePage,
          limit: effectiveLimit,
          totalCount,
          totalPages: Math.ceil(totalCount / effectiveLimit),
          hasMore: effectivePage * effectiveLimit < totalCount,
        },
      };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error fetching workout sessions: ${error}`);
    }
  }
}
