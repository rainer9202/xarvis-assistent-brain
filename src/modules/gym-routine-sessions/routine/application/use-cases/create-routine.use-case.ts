import { Inject, Injectable } from '@nestjs/common';
import {
  ConflictException,
  DomainException,
} from '@domain/exceptions/domain.exception';
import { GetExerciseByIdUseCase } from '@modules/gym-routine-sessions/exercise/application/use-cases/get-exercise-by-id.use-case';
import { RoutineEntity } from '../../domain/entities/routine.entity';
import { ROUTINE_REPOSITORY } from '../../domain/ports/routine.repository.port';
import type { RoutineRepositoryPort } from '../../domain/ports/routine.repository.port';
import { assertRoutineExerciseBounds } from '../shared/assert-routine-exercise-bounds';

export type CreateRoutineResponse = {
  id: string;
};

export type CreateRoutineExerciseInput = {
  exerciseId: string;
  targetSets: number;
  targetReps: number;
  targetWeightGrams: number;
};

export class CreateRoutineCommand {
  constructor(
    public readonly userId: string,
    public readonly name: string,
    public readonly exercises: CreateRoutineExerciseInput[],
  ) {}
}

@Injectable()
export class CreateRoutineUseCase {
  constructor(
    @Inject(ROUTINE_REPOSITORY)
    private readonly repository: RoutineRepositoryPort,
    private readonly getExerciseById: GetExerciseByIdUseCase,
  ) {}

  async execute(command: CreateRoutineCommand): Promise<CreateRoutineResponse> {
    try {
      const existing = await this.repository.findByName(
        command.name,
        command.userId,
      );
      if (existing)
        throw new ConflictException(`Routine "${command.name}" already exists`);

      command.exercises.forEach(assertRoutineExerciseBounds);
      // Independent lookups — run in parallel rather than one round-trip per
      // exercise. Propagates NotFoundException from GetExerciseByIdUseCase
      // when any exerciseId doesn't exist or isn't visible to this user.
      await Promise.all(
        command.exercises.map((exercise) =>
          this.getExerciseById.execute(exercise.exerciseId, command.userId),
        ),
      );

      const entity = new RoutineEntity({
        userId: command.userId,
        name: command.name,
        isActive: true,
      });

      // The array's own index IS the order — no separate `order` field in
      // the command.
      const exerciseInputs = command.exercises.map((exercise, index) => ({
        exerciseId: exercise.exerciseId,
        order: index,
        targetSets: exercise.targetSets,
        targetReps: exercise.targetReps,
        targetWeightGrams: exercise.targetWeightGrams,
      }));

      const saved = await this.repository.save(entity, exerciseInputs);

      return { id: saved.id! };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error creating routine: ${error}`);
    }
  }
}
