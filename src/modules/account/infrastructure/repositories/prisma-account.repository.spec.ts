// PrismaService itself is mocked before any other import so that requiring
// `PrismaAccountRepository` never pulls in the real generated Prisma
// client (ts-jest does not auto-hoist jest.mock() the way babel-jest does,
// so this call must stay above the imports it affects).
jest.mock('@config/database/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { AccountEntity } from '../../domain/entities/account.entity';
import { PrismaAccountRepository } from './prisma-account.repository';
import type { PrismaService } from '@config/database/prisma.service';

describe('PrismaAccountRepository', () => {
  let repository: PrismaAccountRepository;
  let prisma: {
    account: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    movement: {
      count: jest.Mock;
      groupBy: jest.Mock;
    };
    movementType: {
      findMany: jest.Mock;
    };
  };

  const record = {
    id: 'acc-1',
    name: 'Main Checking',
    type: 'bank',
    isActive: true,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
  };

  beforeEach(() => {
    prisma = {
      account: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      movement: {
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      movementType: {
        findMany: jest.fn(),
      },
    };

    repository = new PrismaAccountRepository(
      prisma as unknown as PrismaService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns all records mapped to entities, ordered by createdAt asc', async () => {
      prisma.account.findMany.mockResolvedValue([record]);

      const result = await repository.findAll();

      expect(prisma.account.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(AccountEntity);
      expect(result[0].name).toBe('Main Checking');
    });
  });

  describe('findById', () => {
    it('returns the mapped entity when found', async () => {
      prisma.account.findUnique.mockResolvedValue(record);

      const result = await repository.findById('acc-1');

      expect(prisma.account.findUnique).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
      });
      expect(result).toBeInstanceOf(AccountEntity);
      expect(result?.type).toBe('bank');
    });

    it('returns null when not found', async () => {
      prisma.account.findUnique.mockResolvedValue(null);

      const result = await repository.findById('missing');

      expect(result).toBeNull();
    });
  });

  describe('save', () => {
    it('creates a record from the entity and returns the mapped entity', async () => {
      const entity = new AccountEntity({
        name: 'Main Checking',
        type: 'bank',
        isActive: true,
      });
      prisma.account.create.mockResolvedValue(record);

      const result = await repository.save(entity);

      expect(prisma.account.create).toHaveBeenCalledWith({
        data: {
          id: undefined,
          name: 'Main Checking',
          type: 'bank',
          isActive: true,
        },
      });
      expect(result).toBeInstanceOf(AccountEntity);
      expect(result.name).toBe('Main Checking');
    });
  });

  describe('update', () => {
    it('updates a record from the entity and returns the mapped entity', async () => {
      const entity = new AccountEntity({
        id: 'acc-1',
        name: 'Savings',
        type: 'bank',
        isActive: false,
      });
      prisma.account.update.mockResolvedValue({
        ...record,
        name: 'Savings',
        isActive: false,
      });

      const result = await repository.update(entity);

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { name: 'Savings', type: 'bank', isActive: false },
      });
      expect(result.name).toBe('Savings');
      expect(result.isActive).toBe(false);
    });
  });

  describe('countMovementsByAccountId', () => {
    it('delegates to prisma.movement.count filtered by accountId', async () => {
      prisma.movement.count.mockResolvedValue(3);

      const result = await repository.countMovementsByAccountId('acc-1');

      expect(prisma.movement.count).toHaveBeenCalledWith({
        where: { accountId: 'acc-1' },
      });
      expect(result).toBe(3);
    });
  });

  describe('findAllWithBalance', () => {
    it('computes the type-aware signed balance in cents (income adds, expense subtracts)', async () => {
      prisma.account.findMany.mockResolvedValue([record]);
      prisma.movementType.findMany.mockResolvedValue([
        { id: 'mt-income', name: 'income' },
        { id: 'mt-expense', name: 'expense' },
      ]);
      prisma.movement.groupBy.mockResolvedValue([
        {
          accountId: 'acc-1',
          movementTypeId: 'mt-income',
          _sum: { amount: { toFixed: () => '150.00' } },
        },
        {
          accountId: 'acc-1',
          movementTypeId: 'mt-expense',
          _sum: { amount: { toFixed: () => '30.00' } },
        },
      ]);

      const result = await repository.findAllWithBalance();

      expect(result).toHaveLength(1);
      expect(result[0].account).toBeInstanceOf(AccountEntity);
      expect(result[0].balanceCents).toBe(12000);
    });

    it('defaults balance to 0 cents when the account has zero movements — never null', async () => {
      prisma.account.findMany.mockResolvedValue([record]);
      prisma.movementType.findMany.mockResolvedValue([]);
      prisma.movement.groupBy.mockResolvedValue([]);

      const result = await repository.findAllWithBalance();

      expect(result).toHaveLength(1);
      expect(result[0].account).toBeInstanceOf(AccountEntity);
      expect(result[0].balanceCents).toBe(0);
      expect(result[0].balanceCents).not.toBeNull();
    });
  });
});
