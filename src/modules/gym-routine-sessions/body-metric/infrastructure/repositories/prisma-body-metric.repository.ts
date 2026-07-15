import { Injectable } from '@nestjs/common';
import { PrismaService } from '@config/database/prisma.service';
import { BodyMetricEntity } from '../../domain/entities/body-metric.entity';
import type { BodyMetricRepositoryPort } from '../../domain/ports/body-metric.repository.port';
import { BodyMetricModel } from '@config/database/generated/prisma/models.js';

@Injectable()
export class PrismaBodyMetricRepository implements BodyMetricRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    userId: string,
    page?: number,
    limit?: number,
  ): Promise<BodyMetricEntity[]> {
    const isPaginated = page !== undefined || limit !== undefined;
    const records = await this.prisma.bodyMetric.findMany({
      where: { userId },
      orderBy: { measuredAt: 'desc' },
      ...(isPaginated
        ? {
            skip: ((page ?? 1) - 1) * (limit ?? 20),
            take: limit ?? 20,
          }
        : {}),
    });
    return records.map((record) => this.toEntity(record));
  }

  async findById(id: string, userId: string): Promise<BodyMetricEntity | null> {
    const record = await this.prisma.bodyMetric.findFirst({
      where: { id, userId },
    });
    return record ? this.toEntity(record) : null;
  }

  async create(entity: BodyMetricEntity): Promise<BodyMetricEntity> {
    const record = await this.prisma.bodyMetric.create({
      data: {
        id: entity.id,
        userId: entity.userId,
        weightGrams: entity.weightGrams,
        heightCm: entity.heightCm,
        measuredAt: entity.measuredAt,
      },
    });
    return this.toEntity(record);
  }

  async update(entity: BodyMetricEntity): Promise<BodyMetricEntity> {
    const record = await this.prisma.bodyMetric.update({
      where: { id: entity.id! },
      data: {
        weightGrams: entity.weightGrams,
        heightCm: entity.heightCm,
        measuredAt: entity.measuredAt,
      },
    });
    return this.toEntity(record);
  }

  async delete(entity: BodyMetricEntity): Promise<void> {
    await this.prisma.bodyMetric.delete({ where: { id: entity.id! } });
  }

  async countByUserId(userId: string): Promise<number> {
    return this.prisma.bodyMetric.count({ where: { userId } });
  }

  private toEntity(record: BodyMetricModel): BodyMetricEntity {
    return new BodyMetricEntity({
      id: record.id,
      userId: record.userId,
      weightGrams: record.weightGrams,
      heightCm: record.heightCm,
      measuredAt: record.measuredAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
