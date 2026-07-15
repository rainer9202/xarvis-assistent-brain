import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  NotFoundException,
} from '@domain/exceptions/domain.exception';
import { BODY_METRIC_REPOSITORY } from '../../domain/ports/body-metric.repository.port';
import type { BodyMetricRepositoryPort } from '../../domain/ports/body-metric.repository.port';

export type GetBodyMetricByIdResponse = {
  id: string;
  weightGrams: number;
  heightCm: number;
  measuredAt: Date;
  createdAt: Date;
};

@Injectable()
export class GetBodyMetricByIdUseCase {
  constructor(
    @Inject(BODY_METRIC_REPOSITORY)
    private readonly repository: BodyMetricRepositoryPort,
  ) {}

  async execute(
    id: string,
    userId: string,
  ): Promise<GetBodyMetricByIdResponse> {
    try {
      const metric = await this.repository.findById(id, userId);
      if (!metric) throw new NotFoundException(`Body metric "${id}" not found`);

      return {
        id: metric.id!,
        weightGrams: metric.weightGrams,
        heightCm: metric.heightCm,
        measuredAt: metric.measuredAt,
        createdAt: metric.createdAt!,
      };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error fetching body metric: ${error}`);
    }
  }
}
