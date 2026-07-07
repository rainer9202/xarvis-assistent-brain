// PrismaService itself is mocked before any other import so that requiring
// `PrismaCategoryRepository` never pulls in the real generated Prisma
// client (ts-jest does not auto-hoist jest.mock() the way babel-jest does,
// so this call must stay above the imports it affects).
jest.mock('@config/database/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { CategoryEntity } from '../../domain/entities/category.entity';
import { PrismaCategoryRepository } from './prisma-category.repository';
import type { PrismaService } from '@config/database/prisma.service';

describe('PrismaCategoryRepository', () => {
  let repository: PrismaCategoryRepository;
  let prisma: {
    category: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    movement: {
      count: jest.Mock;
    };
  };

  const record = {
    id: 'cat-1',
    name: 'Groceries',
    movementTypeId: 'mt-1',
    userId: 'user-1',
    isActive: true,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
  };

  beforeEach(() => {
    prisma = {
      category: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      movement: {
        count: jest.fn(),
      },
    };

    repository = new PrismaCategoryRepository(
      prisma as unknown as PrismaService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns records for the given user, mapped to entities, ordered by createdAt asc', async () => {
      prisma.category.findMany.mockResolvedValue([record]);

      const result = await repository.findAll('user-1');

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(CategoryEntity);
      expect(result[0].name).toBe('Groceries');
    });
  });

  describe('findById', () => {
    it('returns the mapped entity when found for that user', async () => {
      prisma.category.findFirst.mockResolvedValue(record);

      const result = await repository.findById('cat-1', 'user-1');

      expect(prisma.category.findFirst).toHaveBeenCalledWith({
        where: { id: 'cat-1', userId: 'user-1' },
      });
      expect(result).toBeInstanceOf(CategoryEntity);
      expect(result?.movementTypeId).toBe('mt-1');
    });

    it('returns null when not found', async () => {
      prisma.category.findFirst.mockResolvedValue(null);

      const result = await repository.findById('missing', 'user-1');

      expect(result).toBeNull();
    });
  });

  describe('findByNameAndMovementTypeId', () => {
    it('returns the mapped entity when found by the compound unique key', async () => {
      prisma.category.findUnique.mockResolvedValue(record);

      const result = await repository.findByNameAndMovementTypeId(
        'Groceries',
        'mt-1',
        'user-1',
      );

      expect(prisma.category.findUnique).toHaveBeenCalledWith({
        where: {
          name_movementTypeId_userId: {
            name: 'Groceries',
            movementTypeId: 'mt-1',
            userId: 'user-1',
          },
        },
      });
      expect(result).toBeInstanceOf(CategoryEntity);
    });

    it('returns null when no record matches', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      const result = await repository.findByNameAndMovementTypeId(
        'missing',
        'mt-1',
        'user-1',
      );

      expect(result).toBeNull();
    });
  });

  describe('save', () => {
    it('creates a record from the entity and returns the mapped entity', async () => {
      const entity = new CategoryEntity({
        name: 'Groceries',
        movementTypeId: 'mt-1',
        userId: 'user-1',
        isActive: true,
      });
      prisma.category.create.mockResolvedValue(record);

      const result = await repository.save(entity);

      expect(prisma.category.create).toHaveBeenCalledWith({
        data: {
          id: undefined,
          name: 'Groceries',
          movementTypeId: 'mt-1',
          userId: 'user-1',
          isActive: true,
        },
      });
      expect(result).toBeInstanceOf(CategoryEntity);
      expect(result.name).toBe('Groceries');
    });
  });

  describe('update', () => {
    it('updates a record from the entity and returns the mapped entity', async () => {
      const entity = new CategoryEntity({
        id: 'cat-1',
        name: 'Supermarket',
        movementTypeId: 'mt-1',
        userId: 'user-1',
        isActive: false,
      });
      prisma.category.update.mockResolvedValue({
        ...record,
        name: 'Supermarket',
        isActive: false,
      });

      const result = await repository.update(entity);

      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
        data: { name: 'Supermarket', movementTypeId: 'mt-1', isActive: false },
      });
      expect(result.name).toBe('Supermarket');
      expect(result.isActive).toBe(false);
    });
  });

  describe('delete', () => {
    it('deletes the record by id', async () => {
      const entity = new CategoryEntity({
        id: 'cat-1',
        name: 'Groceries',
        movementTypeId: 'mt-1',
        userId: 'user-1',
        isActive: true,
      });
      prisma.category.delete.mockResolvedValue(record);

      await repository.delete(entity);

      expect(prisma.category.delete).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
      });
    });
  });

  describe('countMovementsByCategoryId', () => {
    it('delegates to prisma.movement.count filtered by categoryId', async () => {
      prisma.movement.count.mockResolvedValue(3);

      const result = await repository.countMovementsByCategoryId('cat-1');

      expect(prisma.movement.count).toHaveBeenCalledWith({
        where: { categoryId: 'cat-1' },
      });
      expect(result).toBe(3);
    });
  });
});
