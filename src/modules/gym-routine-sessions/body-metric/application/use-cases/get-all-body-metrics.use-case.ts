import { Inject, Injectable } from '@nestjs/common';
import { DomainException } from '@domain/exceptions/domain.exception';
import { BODY_METRIC_REPOSITORY } from '../../domain/ports/body-metric.repository.port';
import type { BodyMetricRepositoryPort } from '../../domain/ports/body-metric.repository.port';

export type GetAllBodyMetricsResponse = {
  id: string;
  weightGrams: number;
  heightCm: number;
  measuredAt: Date;
  createdAt: Date;
};

export type GetAllBodyMetricsResult = {
  items: GetAllBodyMetricsResponse[];
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
export class GetAllBodyMetricsUseCase {
  constructor(
    @Inject(BODY_METRIC_REPOSITORY)
    private readonly repository: BodyMetricRepositoryPort,
  ) {}

  async execute(
    userId: string,
    page?: number,
    limit?: number,
  ): Promise<GetAllBodyMetricsResult> {
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

      const items = entities.map((item) => ({
        id: item.id!,
        weightGrams: item.weightGrams,
        heightCm: item.heightCm,
        measuredAt: item.measuredAt,
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
      throw new Error(`Unexpected error fetching body metrics: ${error}`);
    }
  }
}
