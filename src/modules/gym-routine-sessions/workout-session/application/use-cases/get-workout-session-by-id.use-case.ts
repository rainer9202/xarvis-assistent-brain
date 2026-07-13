import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  NotFoundException,
} from '@domain/exceptions/domain.exception';
import { GetRoutineByIdUseCase } from '@modules/gym-routine-sessions/routine/application/use-cases/get-routine-by-id.use-case';
import { GetExercisesByIdsUseCase } from '@modules/gym-routine-sessions/exercise/application/use-cases/get-exercises-by-ids.use-case';
import { WORKOUT_SESSION_REPOSITORY } from '../../domain/ports/workout-session.repository.port';
import type { WorkoutSessionRepositoryPort } from '../../domain/ports/workout-session.repository.port';

export type GetWorkoutSessionByIdExerciseItem = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  actualSets: number;
  actualReps: number;
  actualWeightGrams: number;
};

export type GetWorkoutSessionByIdResponse = {
  id: string;
  routineId: string;
  routineName: string;
  date: Date;
  finishedAt?: Date | null;
  exercises: GetWorkoutSessionByIdExerciseItem[];
  createdAt: Date;
};

@Injectable()
export class GetWorkoutSessionByIdUseCase {
  constructor(
    @Inject(WORKOUT_SESSION_REPOSITORY)
    private readonly repository: WorkoutSessionRepositoryPort,
    private readonly getRoutineById: GetRoutineByIdUseCase,
    private readonly getExercisesByIds: GetExercisesByIdsUseCase,
  ) {}

  async execute(
    id: string,
    userId: string,
  ): Promise<GetWorkoutSessionByIdResponse> {
    try {
      const result = await this.repository.findByIdWithExercises(id, userId);
      if (!result)
        throw new NotFoundException(`Workout session "${id}" not found`);

      // A single routine lookup (this session references exactly one
      // routine) plus exercise names scoped to just this session's own
      // logged exerciseIds (not the whole catalog, which is unbounded) —
      // resolving exerciseName per logged entry this way avoids an N+1
      // query without paying for a full-catalog fetch.
      const exerciseIds = result.exercises.map((item) => item.exerciseId);
      const [routine, exercises] = await Promise.all([
        this.getRoutineById.execute(result.session.routineId, userId),
        this.getExercisesByIds.execute(exerciseIds, userId),
      ]);
      const exerciseNameById = new Map(exercises.map((e) => [e.id, e.name]));

      return {
        id: result.session.id!,
        routineId: result.session.routineId,
        routineName: routine.name,
        date: result.session.date,
        finishedAt: result.session.finishedAt,
        exercises: result.exercises.map((item) => ({
          id: item.id!,
          exerciseId: item.exerciseId,
          exerciseName:
            exerciseNameById.get(item.exerciseId) ?? item.exerciseId,
          actualSets: item.actualSets,
          actualReps: item.actualReps,
          actualWeightGrams: item.actualWeightGrams,
        })),
        createdAt: result.session.createdAt!,
      };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error fetching workout session: ${error}`);
    }
  }
}
