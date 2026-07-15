jest.mock('@config/database/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { BodyMetricEntity } from '../../domain/entities/body-metric.entity';
import { PrismaBodyMetricRepository } from './prisma-body-metric.repository';
import type { PrismaService } from '@config/database/prisma.service';

describe('PrismaBodyMetricRepository', () => {
  let repository: PrismaBodyMetricRepository;
  let prisma: {
    bodyMetric: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
    };
  };

  const measuredAt = new Date('2026-07-14T10:00:00.000Z');
  const record = {
    id: 'metric-1',
    userId: 'user-1',
    weightGrams: 75000,
    heightCm: 178,
    measuredAt,
    createdAt: new Date('2026-07-14T10:05:00.000Z'),
    updatedAt: new Date('2026-07-14T10:05:00.000Z'),
  };

  beforeEach(() => {
    prisma = {
      bodyMetric: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
    };

    repository = new PrismaBodyMetricRepository(
      prisma as unknown as PrismaService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns records for the given user, mapped to entities, ordered by measuredAt desc', async () => {
      prisma.bodyMetric.findMany.mockResolvedValue([record]);

      const result = await repository.findAll('user-1');

      expect(prisma.bodyMetric.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { measuredAt: 'desc' },
      });
      expect(result[0]).toBeInstanceOf(BodyMetricEntity);
      expect(result[0].weightGrams).toBe(75000);
      expect(result[0].heightCm).toBe(178);
    });

    it('applies skip/take when page/limit are provided (paginated mode)', async () => {
      prisma.bodyMetric.findMany.mockResolvedValue([]);

      await repository.findAll('user-1', 2, 10);

      expect(prisma.bodyMetric.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { measuredAt: 'desc' },
        skip: 10,
        take: 10,
      });
    });

    it('defaults page to 1 and limit to 20 when only one of them is provided', async () => {
      prisma.bodyMetric.findMany.mockResolvedValue([]);

      await repository.findAll('user-1', 3, undefined);

      expect(prisma.bodyMetric.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { measuredAt: 'desc' },
        skip: 40,
        take: 20,
      });
    });

    it('omits skip/take entirely when neither page nor limit is provided', async () => {
      prisma.bodyMetric.findMany.mockResolvedValue([]);

      await repository.findAll('user-1');

      expect(prisma.bodyMetric.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { measuredAt: 'desc' },
      });
    });
  });

  describe('findById', () => {
    it('scopes the lookup by id AND userId via findFirst (not findUnique)', async () => {
      prisma.bodyMetric.findFirst.mockResolvedValue(record);

      const result = await repository.findById('metric-1', 'user-1');

      expect(prisma.bodyMetric.findFirst).toHaveBeenCalledWith({
        where: { id: 'metric-1', userId: 'user-1' },
      });
      expect(result).toBeInstanceOf(BodyMetricEntity);
    });

    it('returns null when no matching row exists for that user', async () => {
      prisma.bodyMetric.findFirst.mockResolvedValue(null);

      const result = await repository.findById('metric-1', 'user-1');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('persists weightGrams as a plain Int (no Decimal/cents conversion)', async () => {
      prisma.bodyMetric.create.mockResolvedValue(record);

      const entity = new BodyMetricEntity({
        userId: 'user-1',
        weightGrams: 75000,
        heightCm: 178,
        measuredAt,
      });
      const result = await repository.create(entity);

      expect(prisma.bodyMetric.create).toHaveBeenCalledWith({
        data: {
          id: undefined,
          userId: 'user-1',
          weightGrams: 75000,
          heightCm: 178,
          measuredAt,
        },
      });
      expect(result).toBeInstanceOf(BodyMetricEntity);
    });
  });

  describe('update', () => {
    it('updates the row scoped by id', async () => {
      prisma.bodyMetric.update.mockResolvedValue(record);

      const entity = new BodyMetricEntity({
        id: 'metric-1',
        userId: 'user-1',
        weightGrams: 76000,
        heightCm: 178,
        measuredAt,
      });
      const result = await repository.update(entity);

      expect(prisma.bodyMetric.update).toHaveBeenCalledWith({
        where: { id: 'metric-1' },
        data: {
          weightGrams: 76000,
          heightCm: 178,
          measuredAt,
        },
      });
      expect(result).toBeInstanceOf(BodyMetricEntity);
    });
  });

  describe('delete', () => {
    it('deletes the row by id', async () => {
      const entity = new BodyMetricEntity({
        id: 'metric-1',
        userId: 'user-1',
        weightGrams: 75000,
        heightCm: 178,
        measuredAt,
      });

      await repository.delete(entity);

      expect(prisma.bodyMetric.delete).toHaveBeenCalledWith({
        where: { id: 'metric-1' },
      });
    });
  });

  describe('countByUserId', () => {
    it('delegates to prisma.bodyMetric.count scoped by userId', async () => {
      prisma.bodyMetric.count.mockResolvedValue(4);

      const result = await repository.countByUserId('user-1');

      expect(prisma.bodyMetric.count).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(result).toBe(4);
    });
  });
});
