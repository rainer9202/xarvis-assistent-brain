import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  NotFoundException,
} from '@domain/exceptions/domain.exception';
import { EXERCISE_REPOSITORY } from '../../domain/ports/exercise.repository.port';
import type { ExerciseRepositoryPort } from '../../domain/ports/exercise.repository.port';

export type GetExerciseByIdResponse = {
  id: string;
  name: string;
  category?: string | null;
  bodyPart?: string | null;
  equipment?: string | null;
  target?: string | null;
  muscleGroup?: string | null;
  secondaryMuscles?: string[];
  instructions?: Record<string, string> | null;
  image?: string | null;
  gifUrl?: string | null;
  attribution?: string | null;
  isCustom: boolean;
  createdAt: Date;
};

// Cross-module-imported by routine and workout-session (same role as
// GetAccountByIdUseCase/GetCategoryByIdUseCase in money-manager).
@Injectable()
export class GetExerciseByIdUseCase {
  constructor(
    @Inject(EXERCISE_REPOSITORY)
    private readonly repository: ExerciseRepositoryPort,
  ) {}

  async execute(id: string, userId: string): Promise<GetExerciseByIdResponse> {
    try {
      // findById allows own OR global rows — read access is broader than
      // write access (see UpdateExerciseUseCase/DeleteExerciseUseCase, which
      // use the stricter findOwnById).
      const exercise = await this.repository.findById(id, userId);
      if (!exercise) throw new NotFoundException(`Exercise "${id}" not found`);

      return {
        id: exercise.id!,
        name: exercise.name,
        category: exercise.category,
        bodyPart: exercise.bodyPart,
        equipment: exercise.equipment,
        target: exercise.target,
        muscleGroup: exercise.muscleGroup,
        secondaryMuscles: exercise.secondaryMuscles,
        instructions: exercise.instructions,
        image: exercise.image,
        gifUrl: exercise.gifUrl,
        attribution: exercise.attribution,
        isCustom: exercise.userId !== null && exercise.userId !== undefined,
        createdAt: exercise.createdAt!,
      };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error fetching exercise: ${error}`);
    }
  }
}
