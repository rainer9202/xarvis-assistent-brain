// PrismaService itself is mocked before any other import so that requiring
// `PrismaMovementRepository` never pulls in the real generated Prisma
// client (ts-jest does not auto-hoist jest.mock() the way babel-jest does,
// so this call must stay above the imports it affects).
jest.mock('@config/database/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { MovementEntity } from '../../domain/entities/movement.entity';
import { PrismaMovementRepository } from './prisma-movement.repository';
import type { PrismaService } from '@config/database/prisma.service';

describe('PrismaMovementRepository', () => {
  let repository: PrismaMovementRepository;
  let prisma: {
    movement: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const date = new Date('2024-01-01T00:00:00Z');

  const record = {
    id: 'mov-1',
    amount: { toFixed: () => '15.00' },
    date,
    note: 'Weekly groceries',
    accountId: 'acc-1',
    toAccountId: null,
    categoryId: 'cat-1',
    movementType: 'Gasto',
    userId: 'user-1',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
  };

  beforeEach(() => {
    prisma = {
      movement: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    repository = new PrismaMovementRepository(
      prisma as unknown as PrismaService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns records for the given user, mapped to entities, ordered by date desc', async () => {
      prisma.movement.findMany.mockResolvedValue([record]);

      const result = await repository.findAll('user-1');

      expect(prisma.movement.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { date: 'desc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(MovementEntity);
      expect(result[0].amountCents).toBe(1500);
      expect(result[0].note).toBe('Weekly groceries');
      expect(result[0].toAccountId).toBeUndefined();
    });
  });

  describe('findById', () => {
    it('returns the mapped entity when found for that user', async () => {
      prisma.movement.findFirst.mockResolvedValue(record);

      const result = await repository.findById('mov-1', 'user-1');

      expect(prisma.movement.findFirst).toHaveBeenCalledWith({
        where: { id: 'mov-1', userId: 'user-1' },
      });
      expect(result).toBeInstanceOf(MovementEntity);
      expect(result?.amountCents).toBe(1500);
    });

    it('returns null when not found', async () => {
      prisma.movement.findFirst.mockResolvedValue(null);

      const result = await repository.findById('missing', 'user-1');

      expect(result).toBeNull();
    });

    it('maps a null note to undefined', async () => {
      prisma.movement.findFirst.mockResolvedValue({ ...record, note: null });

      const result = await repository.findById('mov-1', 'user-1');

      expect(result?.note).toBeUndefined();
    });

    it('maps a null toAccountId to undefined', async () => {
      prisma.movement.findFirst.mockResolvedValue({
        ...record,
        toAccountId: null,
      });

      const result = await repository.findById('mov-1', 'user-1');

      expect(result?.toAccountId).toBeUndefined();
    });

    it('maps a populated toAccountId for a transfer movement', async () => {
      prisma.movement.findFirst.mockResolvedValue({
        ...record,
        toAccountId: 'acc-2',
      });

      const result = await repository.findById('mov-1', 'user-1');

      expect(result?.toAccountId).toBe('acc-2');
    });
  });

  describe('save', () => {
    it('creates a record from the entity, converting cents to a Decimal string, and returns the mapped entity', async () => {
      const entity = new MovementEntity({
        amountCents: 1500,
        date,
        note: 'Weekly groceries',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        movementType: 'Gasto',
        userId: 'user-1',
      });
      prisma.movement.create.mockResolvedValue(record);

      const result = await repository.save(entity);

      expect(prisma.movement.create).toHaveBeenCalledWith({
        data: {
          id: undefined,
          amount: '15.00',
          date,
          note: 'Weekly groceries',
          accountId: 'acc-1',
          toAccountId: null,
          categoryId: 'cat-1',
          movementType: 'Gasto',
          userId: 'user-1',
        },
      });
      expect(result).toBeInstanceOf(MovementEntity);
      expect(result.amountCents).toBe(1500);
    });

    it('creates a transfer record with an explicit toAccountId', async () => {
      const entity = new MovementEntity({
        amountCents: 20000,
        date,
        accountId: 'acc-1',
        toAccountId: 'acc-2',
        categoryId: 'cat-1',
        movementType: 'Transferencia',
        userId: 'user-1',
      });
      prisma.movement.create.mockResolvedValue({
        ...record,
        toAccountId: 'acc-2',
      });

      const result = await repository.save(entity);

      expect(prisma.movement.create).toHaveBeenCalledWith({
        data: {
          id: undefined,
          amount: '200.00',
          date,
          note: undefined,
          accountId: 'acc-1',
          toAccountId: 'acc-2',
          categoryId: 'cat-1',
          movementType: 'Transferencia',
          userId: 'user-1',
        },
      });
      expect(result.toAccountId).toBe('acc-2');
    });
  });

  describe('update', () => {
    it('updates a record from the entity, converting cents to a Decimal string, and returns the mapped entity', async () => {
      const entity = new MovementEntity({
        id: 'mov-1',
        amountCents: 2000,
        date,
        note: 'Updated note',
        accountId: 'acc-2',
        categoryId: 'cat-2',
        movementType: 'Ingreso',
        userId: 'user-1',
      });
      prisma.movement.update.mockResolvedValue({
        ...record,
        amount: { toFixed: () => '20.00' },
        note: 'Updated note',
      });

      const result = await repository.update(entity);

      expect(prisma.movement.update).toHaveBeenCalledWith({
        where: { id: 'mov-1' },
        data: {
          amount: '20.00',
          date,
          note: 'Updated note',
          accountId: 'acc-2',
          toAccountId: null,
          categoryId: 'cat-2',
          movementType: 'Ingreso',
        },
      });
      expect(result.amountCents).toBe(2000);
      expect(result.note).toBe('Updated note');
    });

    it('sends an explicit null for toAccountId when clearing a transfer destination', async () => {
      const entity = new MovementEntity({
        id: 'mov-1',
        amountCents: 2000,
        date,
        accountId: 'acc-2',
        toAccountId: undefined,
        categoryId: 'cat-2',
        movementType: 'Ingreso',
        userId: 'user-1',
      });
      prisma.movement.update.mockResolvedValue({
        ...record,
        toAccountId: null,
      });

      await repository.update(entity);

      expect(prisma.movement.update).toHaveBeenCalledWith({
        where: { id: 'mov-1' },
        data: {
          amount: '20.00',
          date,
          note: undefined,
          accountId: 'acc-2',
          toAccountId: null,
          categoryId: 'cat-2',
          movementType: 'Ingreso',
        },
      });
    });

    it('persists an explicit toAccountId for a transfer movement', async () => {
      const entity = new MovementEntity({
        id: 'mov-1',
        amountCents: 2000,
        date,
        accountId: 'acc-2',
        toAccountId: 'acc-3',
        categoryId: 'cat-2',
        movementType: 'Transferencia',
        userId: 'user-1',
      });
      prisma.movement.update.mockResolvedValue({
        ...record,
        toAccountId: 'acc-3',
      });

      const result = await repository.update(entity);

      expect(prisma.movement.update).toHaveBeenCalledWith({
        where: { id: 'mov-1' },
        data: {
          amount: '20.00',
          date,
          note: undefined,
          accountId: 'acc-2',
          toAccountId: 'acc-3',
          categoryId: 'cat-2',
          movementType: 'Transferencia',
        },
      });
      expect(result.toAccountId).toBe('acc-3');
    });
  });

  describe('delete', () => {
    it('deletes the record by id', async () => {
      const entity = new MovementEntity({
        id: 'mov-1',
        amountCents: 1500,
        date,
        accountId: 'acc-1',
        categoryId: 'cat-1',
        movementType: 'Gasto',
        userId: 'user-1',
      });
      prisma.movement.delete.mockResolvedValue(record);

      await repository.delete(entity);

      expect(prisma.movement.delete).toHaveBeenCalledWith({
        where: { id: 'mov-1' },
      });
    });
  });
});
