import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  NotFoundException,
} from '@domain/exceptions/domain.exception';
import { GetExercisesByIdsUseCase } from '@modules/gym-routine-sessions/exercise/application/use-cases/get-exercises-by-ids.use-case';
import { ROUTINE_REPOSITORY } from '../../domain/ports/routine.repository.port';
import type { RoutineRepositoryPort } from '../../domain/ports/routine.repository.port';

export type GetRoutineByIdExerciseItem = {
  exerciseId: string;
  exerciseName: string;
  order: number;
  targetSets: number;
  targetReps: number;
  targetWeightGrams: number;
};

export type GetRoutineByIdResponse = {
  id: string;
  name: string;
  isActive: boolean;
  exercises: GetRoutineByIdExerciseItem[];
  createdAt: Date;
};

// Cross-module-imported by workout-session (to validate routineId on session
// creation).
@Injectable()
export class GetRoutineByIdUseCase {
  constructor(
    @Inject(ROUTINE_REPOSITORY)
    private readonly repository: RoutineRepositoryPort,
    private readonly getExercisesByIds: GetExercisesByIdsUseCase,
  ) {}

  async execute(id: string, userId: string): Promise<GetRoutineByIdResponse> {
    try {
      const result = await this.repository.findByIdWithExercises(id, userId);
      if (!result) throw new NotFoundException(`Routine "${id}" not found`);

      // Scoped to just this routine's own exercise ids (not the whole
      // catalog, which is unbounded — 1,300+ seeded rows) to resolve names
      // without an N+1 query.
      const exerciseIds = result.exercises.map((item) => item.exerciseId);
      const exercises = await this.getExercisesByIds.execute(
        exerciseIds,
        userId,
      );
      const exerciseNameById = new Map(exercises.map((e) => [e.id, e.name]));

      return {
        id: result.routine.id!,
        name: result.routine.name,
        isActive: result.routine.isActive!,
        exercises: result.exercises.map((item) => ({
          exerciseId: item.exerciseId,
          exerciseName:
            exerciseNameById.get(item.exerciseId) ?? item.exerciseId,
          order: item.order,
          targetSets: item.targetSets,
          targetReps: item.targetReps,
          targetWeightGrams: item.targetWeightGrams,
        })),
        createdAt: result.routine.createdAt!,
      };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error fetching routine: ${error}`);
    }
  }
}
