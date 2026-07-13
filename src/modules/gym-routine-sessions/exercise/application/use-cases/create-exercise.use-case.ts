import { Inject, Injectable } from '@nestjs/common';
import { DomainException } from '@domain/exceptions/domain.exception';
import { ExerciseEntity } from '../../domain/entities/exercise.entity';
import { EXERCISE_REPOSITORY } from '../../domain/ports/exercise.repository.port';
import type { ExerciseRepositoryPort } from '../../domain/ports/exercise.repository.port';

export type CreateExerciseResponse = {
  id: string;
};

export class CreateExerciseCommand {
  constructor(
    public readonly userId: string,
    public readonly name: string,
    public readonly category?: string,
    public readonly bodyPart?: string,
    public readonly equipment?: string,
    public readonly target?: string,
    public readonly muscleGroup?: string,
  ) {}
}

@Injectable()
export class CreateExerciseUseCase {
  constructor(
    @Inject(EXERCISE_REPOSITORY)
    private readonly repository: ExerciseRepositoryPort,
  ) {}

  async execute(
    command: CreateExerciseCommand,
  ): Promise<CreateExerciseResponse> {
    try {
      const entity = new ExerciseEntity({
        userId: command.userId,
        name: command.name,
        category: command.category,
        bodyPart: command.bodyPart,
        equipment: command.equipment,
        target: command.target,
        muscleGroup: command.muscleGroup,
      });
      const saved = await this.repository.save(entity);

      return { id: saved.id! };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error creating exercise: ${error}`);
    }
  }
}
