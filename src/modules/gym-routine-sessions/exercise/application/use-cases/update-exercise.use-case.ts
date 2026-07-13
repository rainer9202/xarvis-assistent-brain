import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  NotFoundException,
} from '@domain/exceptions/domain.exception';
import { EXERCISE_REPOSITORY } from '../../domain/ports/exercise.repository.port';
import type { ExerciseRepositoryPort } from '../../domain/ports/exercise.repository.port';

export type UpdateExerciseResponse = {
  id: string;
};

export class UpdateExerciseCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly name?: string,
    public readonly category?: string,
    public readonly bodyPart?: string,
    public readonly equipment?: string,
    public readonly target?: string,
    public readonly muscleGroup?: string,
  ) {}
}

@Injectable()
export class UpdateExerciseUseCase {
  constructor(
    @Inject(EXERCISE_REPOSITORY)
    private readonly repository: ExerciseRepositoryPort,
  ) {}

  async execute(
    command: UpdateExerciseCommand,
  ): Promise<UpdateExerciseResponse> {
    try {
      // findOwnById excludes global (userId: null) rows and other users'
      // rows — both must be indistinguishable from "not found" for a write
      // attempt, per AGENTS.md's ownership principle extended to global rows.
      const exercise = await this.repository.findOwnById(
        command.id,
        command.userId,
      );
      if (!exercise)
        throw new NotFoundException(`Exercise "${command.id}" not found`);

      if (command.name !== undefined) exercise.name = command.name;
      if (command.category !== undefined) exercise.category = command.category;
      if (command.bodyPart !== undefined) exercise.bodyPart = command.bodyPart;
      if (command.equipment !== undefined)
        exercise.equipment = command.equipment;
      if (command.target !== undefined) exercise.target = command.target;
      if (command.muscleGroup !== undefined)
        exercise.muscleGroup = command.muscleGroup;

      const saved = await this.repository.update(exercise);

      return { id: saved.id! };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error updating exercise: ${error}`);
    }
  }
}
