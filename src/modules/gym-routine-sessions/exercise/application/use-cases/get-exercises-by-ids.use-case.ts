import { Inject, Injectable } from '@nestjs/common';
import { DomainException } from '@domain/exceptions/domain.exception';
import { EXERCISE_REPOSITORY } from '../../domain/ports/exercise.repository.port';
import type { ExerciseRepositoryPort } from '../../domain/ports/exercise.repository.port';
import type { GetAllExercisesResponse } from './get-all-exercises.use-case';

// Cross-module-imported by routine/workout-session to resolve exercise names
// for a bounded set of ids (e.g. one routine's exercise list) without paying
// for a full-catalog fetch — see GetAllExercisesUseCase for the unscoped
// equivalent, which is unsuitable here since the exercise catalog is an
// unbounded global table (1,300+ seeded rows), not a small owned one like
// Category/Group.
@Injectable()
export class GetExercisesByIdsUseCase {
  constructor(
    @Inject(EXERCISE_REPOSITORY)
    private readonly repository: ExerciseRepositoryPort,
  ) {}

  async execute(
    ids: string[],
    userId: string,
  ): Promise<GetAllExercisesResponse[]> {
    try {
      const uniqueIds = [...new Set(ids)];
      const entities = await this.repository.findByIds(uniqueIds, userId);
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
        isCustom: item.userId !== null && item.userId !== undefined,
        createdAt: item.createdAt!,
      }));
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error fetching exercises: ${error}`);
    }
  }
}
