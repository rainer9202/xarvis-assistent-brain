import { Inject, Injectable } from '@nestjs/common';
import { DomainException } from '@domain/exceptions/domain.exception';
import { EXERCISE_REPOSITORY } from '../../domain/ports/exercise.repository.port';
import type { ExerciseRepositoryPort } from '../../domain/ports/exercise.repository.port';

export type GetAllExercisesResponse = {
  id: string;
  name: string;
  nameEs?: string | null;
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

@Injectable()
export class GetAllExercisesUseCase {
  constructor(
    @Inject(EXERCISE_REPOSITORY)
    private readonly repository: ExerciseRepositoryPort,
  ) {}

  async execute(userId: string): Promise<GetAllExercisesResponse[]> {
    try {
      const entities = await this.repository.findAll(userId);
      return entities.map((item) => ({
        id: item.id!,
        name: item.name,
        nameEs: item.nameEs,
        category: item.category,
        bodyPart: item.bodyPart,
        equipment: item.equipment,
        target: item.target,
        muscleGroup: item.muscleGroup,
        secondaryMuscles: item.secondaryMuscles,
        instructions: item.instructions,
        image: item.image,
        gifUrl: item.gifUrl,
        attribution: item.attribution,
        // userId is an internal detail never exposed in any response — the
        // frontend only needs to know whether this exercise is user-owned
        // (editable/deletable) or a global/seeded catalog entry.
        isCustom: item.userId !== null && item.userId !== undefined,
        createdAt: item.createdAt!,
      }));
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error fetching exercises: ${error}`);
    }
  }
}
