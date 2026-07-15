import { Module } from '@nestjs/common';
import { CreateBodyMetricUseCase } from './application/use-cases/create-body-metric.use-case';
import { UpdateBodyMetricUseCase } from './application/use-cases/update-body-metric.use-case';
import { DeleteBodyMetricUseCase } from './application/use-cases/delete-body-metric.use-case';
import { GetAllBodyMetricsUseCase } from './application/use-cases/get-all-body-metrics.use-case';
import { GetBodyMetricByIdUseCase } from './application/use-cases/get-body-metric-by-id.use-case';
import { BODY_METRIC_REPOSITORY } from './domain/ports/body-metric.repository.port';
import { BodyMetricController } from './infrastructure/controllers/body-metric.controller';
import { PrismaBodyMetricRepository } from './infrastructure/repositories/prisma-body-metric.repository';

@Module({
  controllers: [BodyMetricController],
  providers: [
    {
      provide: BODY_METRIC_REPOSITORY,
      useClass: PrismaBodyMetricRepository,
    },
    GetAllBodyMetricsUseCase,
    GetBodyMetricByIdUseCase,
    CreateBodyMetricUseCase,
    UpdateBodyMetricUseCase,
    DeleteBodyMetricUseCase,
  ],
})
export class BodyMetricModule {}
