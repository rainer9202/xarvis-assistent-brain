import { Inject, Injectable } from '@nestjs/common';
import {
  ConflictException,
  DomainException,
  NotFoundException,
} from '@domain/exceptions/domain.exception';
import { GetExerciseByIdUseCase } from '@modules/gym-routine-sessions/exercise/application/use-cases/get-exercise-by-id.use-case';
import { ROUTINE_REPOSITORY } from '../../domain/ports/routine.repository.port';
import type { RoutineRepositoryPort } from '../../domain/ports/routine.repository.port';
import { assertRoutineExerciseBounds } from '../shared/assert-routine-exercise-bounds';

export type UpdateRoutineResponse = {
  id: string;
};

export type UpdateRoutineExerciseInput = {
  exerciseId: string;
  targetSets: number;
  targetReps: number;
  targetWeightGrams: number;
};

export class UpdateRoutineCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly name?: string,
    public readonly isActive?: boolean,
    // undefined => untouched; [] => remove all exercises; array => full
    // replace. No `null` state needed (unlike Group.budgetCents) since an
    // empty array already unambiguously means "no exercises".
    public readonly exercises?: UpdateRoutineExerciseInput[],
  ) {}
}

@Injectable()
export class UpdateRoutineUseCase {
  constructor(
    @Inject(ROUTINE_REPOSITORY)
    private readonly repository: RoutineRepositoryPort,
    private readonly getExerciseById: GetExerciseByIdUseCase,
  ) {}

  async execute(command: UpdateRoutineCommand): Promise<UpdateRoutineResponse> {
    try {
      const routine = await this.repository.findById(
        command.id,
        command.userId,
      );
      if (!routine)
        throw new NotFoundException(`Routine "${command.id}" not found`);

      if (command.name !== undefined && command.name !== routine.name) {
        const existing = await this.repository.findByName(
          command.name,
          command.userId,
        );
        if (existing && existing.id !== routine.id)
          throw new ConflictException(
            `Routine "${command.name}" already exists`,
          );
        routine.name = command.name;
      }
      if (command.isActive !== undefined) routine.isActive = command.isActive;

      let exerciseInputs:
        | {
            exerciseId: string;
            order: number;
            targetSets: number;
            targetReps: number;
            targetWeightGrams: number;
          }[]
        | undefined;

      if (command.exercises !== undefined) {
        command.exercises.forEach(assertRoutineExerciseBounds);
        // Independent lookups — run in parallel rather than one round-trip
        // per exercise.
        await Promise.all(
          command.exercises.map((exercise) =>
            this.getExerciseById.execute(exercise.exerciseId, command.userId),
          ),
        );
        exerciseInputs = command.exercises.map((exercise, index) => ({
          exerciseId: exercise.exerciseId,
          order: index,
          targetSets: exercise.targetSets,
          targetReps: exercise.targetReps,
          targetWeightGrams: exercise.targetWeightGrams,
        }));
      }

      const saved = await this.repository.update(routine, exerciseInputs);

      return { id: saved.id! };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error updating routine: ${error}`);
    }
  }
}
