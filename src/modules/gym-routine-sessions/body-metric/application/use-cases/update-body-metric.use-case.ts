import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  NotFoundException,
} from '@domain/exceptions/domain.exception';
import { BODY_METRIC_REPOSITORY } from '../../domain/ports/body-metric.repository.port';
import type { BodyMetricRepositoryPort } from '../../domain/ports/body-metric.repository.port';

export type UpdateBodyMetricResponse = {
  id: string;
};

export class UpdateBodyMetricCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly weightGrams?: number,
    public readonly heightCm?: number,
    public readonly measuredAt?: Date,
  ) {}
}

@Injectable()
export class UpdateBodyMetricUseCase {
  constructor(
    @Inject(BODY_METRIC_REPOSITORY)
    private readonly repository: BodyMetricRepositoryPort,
  ) {}

  async execute(
    command: UpdateBodyMetricCommand,
  ): Promise<UpdateBodyMetricResponse> {
    try {
      const metric = await this.repository.findById(command.id, command.userId);
      if (!metric)
        throw new NotFoundException(`Body metric "${command.id}" not found`);

      if (command.weightGrams !== undefined)
        metric.weightGrams = command.weightGrams;
      if (command.heightCm !== undefined) metric.heightCm = command.heightCm;
      if (command.measuredAt !== undefined)
        metric.measuredAt = command.measuredAt;

      const saved = await this.repository.update(metric);

      return { id: saved.id! };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error updating body metric: ${error}`);
    }
  }
}
