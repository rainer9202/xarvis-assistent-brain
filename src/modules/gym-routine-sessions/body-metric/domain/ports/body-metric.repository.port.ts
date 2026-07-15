import { BodyMetricEntity } from '../entities/body-metric.entity';

export interface BodyMetricRepositoryPort {
  findAll(
    userId: string,
    page?: number,
    limit?: number,
  ): Promise<BodyMetricEntity[]>;
  findById(id: string, userId: string): Promise<BodyMetricEntity | null>;
  create(entity: BodyMetricEntity): Promise<BodyMetricEntity>;
  update(entity: BodyMetricEntity): Promise<BodyMetricEntity>;
  delete(entity: BodyMetricEntity): Promise<void>;
  countByUserId(userId: string): Promise<number>;
}

export const BODY_METRIC_REPOSITORY = Symbol('BodyMetricRepositoryPort');
