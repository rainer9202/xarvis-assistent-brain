import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  NotFoundException,
} from '@domain/exceptions/domain.exception';
import { BODY_METRIC_REPOSITORY } from '../../domain/ports/body-metric.repository.port';
import type { BodyMetricRepositoryPort } from '../../domain/ports/body-metric.repository.port';

export type DeleteBodyMetricResponse = {
  id: string;
};

export class DeleteBodyMetricCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}

@Injectable()
export class DeleteBodyMetricUseCase {
  constructor(
    @Inject(BODY_METRIC_REPOSITORY)
    private readonly repository: BodyMetricRepositoryPort,
  ) {}

  async execute(
    command: DeleteBodyMetricCommand,
  ): Promise<DeleteBodyMetricResponse> {
    try {
      const metric = await this.repository.findById(command.id, command.userId);
      if (!metric)
        throw new NotFoundException(`Body metric "${command.id}" not found`);

      await this.repository.delete(metric);

      return { id: command.id };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error deleting body metric: ${error}`);
    }
  }
}
