// PrismaService itself is mocked before any other import so that requiring
// `PrismaGroupRepository` never pulls in the real generated Prisma client
// (ts-jest does not auto-hoist jest.mock() the way babel-jest does, so this
// call must stay above the imports it affects).
jest.mock('@config/database/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { GroupEntity } from '../../domain/entities/group.entity';
import { PrismaGroupRepository } from './prisma-group.repository';
import type { PrismaService } from '@config/database/prisma.service';

describe('PrismaGroupRepository', () => {
  let repository: PrismaGroupRepository;
  let prisma: {
    group: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const record = {
    id: 'grp-1',
    name: 'Fixed Expenses',
    userId: 'user-1',
    isActive: true,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
  };

  beforeEach(() => {
    prisma = {
      group: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    repository = new PrismaGroupRepository(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns records for the given user, mapped to entities, ordered by createdAt asc', async () => {
      prisma.group.findMany.mockResolvedValue([record]);

      const result = await repository.findAll('user-1');

      expect(prisma.group.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(GroupEntity);
      expect(result[0].name).toBe('Fixed Expenses');
    });
  });

  describe('findById', () => {
    it('returns the mapped entity when found for that user', async () => {
      prisma.group.findFirst.mockResolvedValue(record);

      const result = await repository.findById('grp-1', 'user-1');

      expect(prisma.group.findFirst).toHaveBeenCalledWith({
        where: { id: 'grp-1', userId: 'user-1' },
      });
      expect(result).toBeInstanceOf(GroupEntity);
    });

    it('returns null when not found', async () => {
      prisma.group.findFirst.mockResolvedValue(null);

      const result = await repository.findById('missing', 'user-1');

      expect(result).toBeNull();
    });
  });

  describe('findByName', () => {
    it('returns the mapped entity when found', async () => {
      prisma.group.findUnique.mockResolvedValue(record);

      const result = await repository.findByName('Fixed Expenses', 'user-1');

      expect(prisma.group.findUnique).toHaveBeenCalledWith({
        where: {
          name_userId: { name: 'Fixed Expenses', userId: 'user-1' },
        },
      });
      expect(result).toBeInstanceOf(GroupEntity);
    });

    it('returns null when not found', async () => {
      prisma.group.findUnique.mockResolvedValue(null);

      const result = await repository.findByName('missing', 'user-1');

      expect(result).toBeNull();
    });
  });

  describe('save', () => {
    it('creates a record from the entity and returns the mapped entity', async () => {
      const entity = new GroupEntity({
        name: 'Fixed Expenses',
        userId: 'user-1',
        isActive: true,
      });
      prisma.group.create.mockResolvedValue(record);

      const result = await repository.save(entity);

      expect(prisma.group.create).toHaveBeenCalledWith({
        data: {
          id: undefined,
          name: 'Fixed Expenses',
          userId: 'user-1',
          isActive: true,
          budgetCents: null,
        },
      });
      expect(result).toBeInstanceOf(GroupEntity);
    });

    it('creates a record with the given budgetCents when provided', async () => {
      const entity = new GroupEntity({
        name: 'Fixed Expenses',
        userId: 'user-1',
        isActive: true,
        budgetCents: 5000000,
      });
      prisma.group.create.mockResolvedValue({
        ...record,
        budgetCents: 5000000,
      });

      await repository.save(entity);

      expect(prisma.group.create).toHaveBeenCalledWith({
        data: {
          id: undefined,
          name: 'Fixed Expenses',
          userId: 'user-1',
          isActive: true,
          budgetCents: '50000.00',
        },
      });
    });
  });

  describe('update', () => {
    it('updates a record from the entity and returns the mapped entity', async () => {
      const entity = new GroupEntity({
        id: 'grp-1',
        name: 'Renamed',
        userId: 'user-1',
        isActive: false,
      });
      prisma.group.update.mockResolvedValue({
        ...record,
        name: 'Renamed',
        isActive: false,
      });

      const result = await repository.update(entity);

      expect(prisma.group.update).toHaveBeenCalledWith({
        where: { id: 'grp-1' },
        data: { name: 'Renamed', isActive: false, budgetCents: null },
      });
      expect(result.name).toBe('Renamed');
    });

    it('sends budgetCents through to the update data as-is (including null)', async () => {
      const entity = new GroupEntity({
        id: 'grp-1',
        name: 'Renamed',
        userId: 'user-1',
        isActive: false,
        budgetCents: null,
      });
      prisma.group.update.mockResolvedValue({
        ...record,
        name: 'Renamed',
        isActive: false,
        budgetCents: null,
      });

      await repository.update(entity);

      expect(prisma.group.update).toHaveBeenCalledWith({
        where: { id: 'grp-1' },
        data: { name: 'Renamed', isActive: false, budgetCents: null },
      });
    });
  });

  describe('delete', () => {
    it('deletes by id', async () => {
      const entity = new GroupEntity({
        id: 'grp-1',
        name: 'Fixed Expenses',
        userId: 'user-1',
        isActive: true,
      });

      await repository.delete(entity);

      expect(prisma.group.delete).toHaveBeenCalledWith({
        where: { id: 'grp-1' },
      });
    });
  });
});
