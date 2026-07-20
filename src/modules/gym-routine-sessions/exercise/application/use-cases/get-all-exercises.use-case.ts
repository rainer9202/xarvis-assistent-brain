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

export type GetAllExercisesResult = {
  items: GetAllExercisesResponse[];
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
export class GetAllExercisesUseCase {
  constructor(
    @Inject(EXERCISE_REPOSITORY)
    private readonly repository: ExerciseRepositoryPort,
  ) {}

  async execute(
    userId: string,
    page?: number,
    limit?: number,
    search?: string,
    isCustom?: boolean,
  ): Promise<GetAllExercisesResult> {
    try {
      const isPaginated = page !== undefined || limit !== undefined;
      const effectivePage = page ?? DEFAULT_PAGE;
      const effectiveLimit = limit ?? DEFAULT_LIMIT;

      const [entities, totalCount] = await Promise.all([
        this.repository.findAll(
          userId,
          isPaginated ? effectivePage : undefined,
          isPaginated ? effectiveLimit : undefined,
          search,
          isCustom,
        ),
        isPaginated
          ? this.repository.countByUserId(userId, search, isCustom)
          : Promise.resolve(undefined),
      ]);

      const items = entities.map((item) => ({
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
      throw new Error(`Unexpected error fetching exercises: ${error}`);
    }
  }
}
