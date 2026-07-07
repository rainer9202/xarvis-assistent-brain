// PrismaService itself is mocked before any other import so that requiring
// `PrismaMovementTypeRepository` never pulls in the real generated Prisma
// client (ts-jest does not auto-hoist jest.mock() the way babel-jest does,
// so this call must stay above the imports it affects).
jest.mock('@config/database/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { MovementTypeEntity } from '../../domain/entities/movement-type.entity';
import { PrismaMovementTypeRepository } from './prisma-movement-type.repository';
import type { PrismaService } from '@config/database/prisma.service';

describe('PrismaMovementTypeRepository', () => {
  let repository: PrismaMovementTypeRepository;
  let prisma: {
    movementType: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
    };
    category: {
      count: jest.Mock;
    };
    movement: {
      count: jest.Mock;
    };
  };

  const record = {
    id: 'mt-1',
    name: 'expense',
    isDefault: false,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
  };

  beforeEach(() => {
    prisma = {
      movementType: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      category: {
        count: jest.fn(),
      },
      movement: {
        count: jest.fn(),
      },
    };

    repository = new PrismaMovementTypeRepository(
      prisma as unknown as PrismaService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns all records mapped to entities, ordered by createdAt asc', async () => {
      prisma.movementType.findMany.mockResolvedValue([record]);

      const result = await repository.findAll();

      expect(prisma.movementType.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(MovementTypeEntity);
      expect(result[0].id).toBe('mt-1');
      expect(result[0].name).toBe('expense');
    });
  });

  describe('findById', () => {
    it('returns the mapped entity when found', async () => {
      prisma.movementType.findUnique.mockResolvedValue(record);

      const result = await repository.findById('mt-1');

      expect(prisma.movementType.findUnique).toHaveBeenCalledWith({
        where: { id: 'mt-1' },
      });
      expect(result).toBeInstanceOf(MovementTypeEntity);
      expect(result?.name).toBe('expense');
    });

    it('returns null when not found', async () => {
      prisma.movementType.findUnique.mockResolvedValue(null);

      const result = await repository.findById('missing');

      expect(result).toBeNull();
    });
  });

  describe('findByName', () => {
    it('returns the mapped entity when found by name', async () => {
      prisma.movementType.findUnique.mockResolvedValue(record);

      const result = await repository.findByName('expense');

      expect(prisma.movementType.findUnique).toHaveBeenCalledWith({
        where: { name: 'expense' },
      });
      expect(result).toBeInstanceOf(MovementTypeEntity);
    });

    it('returns null when no record matches the name', async () => {
      prisma.movementType.findUnique.mockResolvedValue(null);

      const result = await repository.findByName('missing');

      expect(result).toBeNull();
    });
  });

  describe('save', () => {
    it('creates a record from the entity and returns the mapped entity', async () => {
      const entity = new MovementTypeEntity({ id: 'mt-1', name: 'expense' });
      prisma.movementType.create.mockResolvedValue(record);

      const result = await repository.save(entity);

      expect(prisma.movementType.create).toHaveBeenCalledWith({
        data: { id: 'mt-1', name: 'expense' },
      });
      expect(result).toBeInstanceOf(MovementTypeEntity);
      expect(result.name).toBe('expense');
    });
  });

  describe('delete', () => {
    it('deletes the record by the entity id', async () => {
      const entity = new MovementTypeEntity({ id: 'mt-1', name: 'expense' });

      await repository.delete(entity);

      expect(prisma.movementType.delete).toHaveBeenCalledWith({
        where: { id: 'mt-1' },
      });
    });
  });

  describe('countCategoriesByMovementTypeId', () => {
    it('delegates to prisma.category.count filtered by movementTypeId', async () => {
      prisma.category.count.mockResolvedValue(2);

      const result = await repository.countCategoriesByMovementTypeId('mt-1');

      expect(prisma.category.count).toHaveBeenCalledWith({
        where: { movementTypeId: 'mt-1' },
      });
      expect(result).toBe(2);
    });
  });

  describe('countMovementsByMovementTypeId', () => {
    it('delegates to prisma.movement.count filtered by movementTypeId', async () => {
      prisma.movement.count.mockResolvedValue(5);

      const result = await repository.countMovementsByMovementTypeId('mt-1');

      expect(prisma.movement.count).toHaveBeenCalledWith({
        where: { movementTypeId: 'mt-1' },
      });
      expect(result).toBe(5);
    });
  });
});
