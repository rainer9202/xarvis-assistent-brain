import { Inject, Injectable } from '@nestjs/common';
import { DomainException } from '@domain/exceptions/domain.exception';
import { ROUTINE_REPOSITORY } from '../../domain/ports/routine.repository.port';
import type { RoutineRepositoryPort } from '../../domain/ports/routine.repository.port';

export type GetAllRoutinesResponse = {
  id: string;
  name: string;
  isActive: boolean;
  exerciseCount: number;
  createdAt: Date;
};

export type GetAllRoutinesResult = {
  items: GetAllRoutinesResponse[];
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
export class GetAllRoutinesUseCase {
  constructor(
    @Inject(ROUTINE_REPOSITORY)
    private readonly repository: RoutineRepositoryPort,
  ) {}

  async execute(
    userId: string,
    page?: number,
    limit?: number,
  ): Promise<GetAllRoutinesResult> {
    try {
      const isPaginated = page !== undefined || limit !== undefined;
      const effectivePage = page ?? DEFAULT_PAGE;
      const effectiveLimit = limit ?? DEFAULT_LIMIT;

      const [entities, totalCount] = await Promise.all([
        this.repository.findAll(
          userId,
          isPaginated ? effectivePage : undefined,
          isPaginated ? effectiveLimit : undefined,
        ),
        isPaginated
          ? this.repository.countByUserId(userId)
          : Promise.resolve(undefined),
      ]);

      const items = entities.map(({ routine, exerciseCount }) => ({
        id: routine.id!,
        name: routine.name,
        isActive: routine.isActive!,
        exerciseCount,
        createdAt: routine.createdAt!,
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
      throw new Error(`Unexpected error fetching routines: ${error}`);
    }
  }
}
