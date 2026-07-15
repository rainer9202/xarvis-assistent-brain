import { Inject, Injectable } from '@nestjs/common';
import { DomainException } from '@domain/exceptions/domain.exception';
import { BodyMetricEntity } from '../../domain/entities/body-metric.entity';
import { BODY_METRIC_REPOSITORY } from '../../domain/ports/body-metric.repository.port';
import type { BodyMetricRepositoryPort } from '../../domain/ports/body-metric.repository.port';

export type CreateBodyMetricResponse = {
  id: string;
};

export class CreateBodyMetricCommand {
  constructor(
    public readonly userId: string,
    public readonly weightGrams: number,
    public readonly heightCm: number,
    public readonly measuredAt?: Date,
  ) {}
}

@Injectable()
export class CreateBodyMetricUseCase {
  constructor(
    @Inject(BODY_METRIC_REPOSITORY)
    private readonly repository: BodyMetricRepositoryPort,
  ) {}

  async execute(
    command: CreateBodyMetricCommand,
  ): Promise<CreateBodyMetricResponse> {
    try {
      const entity = new BodyMetricEntity({
        userId: command.userId,
        weightGrams: command.weightGrams,
        heightCm: command.heightCm,
        measuredAt: command.measuredAt ?? new Date(),
      });
      const saved = await this.repository.create(entity);

      return { id: saved.id! };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error creating body metric: ${error}`);
    }
  }
}
