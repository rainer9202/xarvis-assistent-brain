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
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    movement: {
      count: jest.Mock;
      groupBy: jest.Mock;
      aggregate: jest.Mock;
    };
  };

  const record = {
    id: 'acc-1',
    name: 'Main Checking',
    type: 'bank',
    userId: 'user-1',
    isActive: true,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
  };

  beforeEach(() => {
    prisma = {
      account: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      movement: {
        count: jest.fn(),
        groupBy: jest.fn(),
        aggregate: jest.fn(),
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
    it('returns records for the given user, mapped to entities, ordered by createdAt asc', async () => {
      prisma.account.findMany.mockResolvedValue([record]);

      const result = await repository.findAll('user-1');

      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(AccountEntity);
      expect(result[0].name).toBe('Main Checking');
    });
  });

  describe('findById', () => {
    it('returns the mapped entity when found for that user', async () => {
      prisma.account.findFirst.mockResolvedValue(record);

      const result = await repository.findById('acc-1', 'user-1');

      expect(prisma.account.findFirst).toHaveBeenCalledWith({
        where: { id: 'acc-1', userId: 'user-1' },
      });
      expect(result).toBeInstanceOf(AccountEntity);
      expect(result?.type).toBe('bank');
    });

    it('returns null when not found', async () => {
      prisma.account.findFirst.mockResolvedValue(null);

      const result = await repository.findById('missing', 'user-1');

      expect(result).toBeNull();
    });
  });

  describe('save', () => {
    it('creates a record from the entity and returns the mapped entity', async () => {
      const entity = new AccountEntity({
        name: 'Main Checking',
        type: 'bank',
        userId: 'user-1',
        isActive: true,
      });
      prisma.account.create.mockResolvedValue(record);

      const result = await repository.save(entity);

      expect(prisma.account.create).toHaveBeenCalledWith({
        data: {
          id: undefined,
          name: 'Main Checking',
          type: 'bank',
          userId: 'user-1',
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
        userId: 'user-1',
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

  describe('delete', () => {
    it('deletes the record by id', async () => {
      const entity = new AccountEntity({
        id: 'acc-1',
        name: 'Main Checking',
        type: 'bank',
        userId: 'user-1',
        isActive: true,
      });
      prisma.account.delete.mockResolvedValue(record);

      await repository.delete(entity);

      expect(prisma.account.delete).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
      });
    });
  });

  describe('countMovementsByAccountId', () => {
    it('delegates to prisma.movement.count filtered by accountId or toAccountId', async () => {
      prisma.movement.count.mockResolvedValue(3);

      const result = await repository.countMovementsByAccountId('acc-1');

      expect(prisma.movement.count).toHaveBeenCalledWith({
        where: { OR: [{ accountId: 'acc-1' }, { toAccountId: 'acc-1' }] },
      });
      expect(result).toBe(3);
    });
  });

  describe('findAllWithBalance', () => {
    const accountB = {
      ...record,
      id: 'acc-2',
      name: 'Cash',
    };

    it('computes the type-aware signed balance in cents (income adds, expense subtracts)', async () => {
      prisma.account.findMany.mockResolvedValue([record]);
      // The non-transfer groupBy always excludes 'Transferencia'; here it
      // returns income and expense sums, then the transfer groupBy calls
      // (transfersOut, transfersIn) return empty.
      prisma.movement.groupBy
        .mockResolvedValueOnce([
          {
            accountId: 'acc-1',
            movementType: 'Ingreso',
            _sum: { amount: { toFixed: () => '150.00' } },
          },
          {
            accountId: 'acc-1',
            movementType: 'Gasto',
            _sum: { amount: { toFixed: () => '30.00' } },
          },
        ])
        .mockResolvedValueOnce([]) // transfersOut
        .mockResolvedValueOnce([]); // transfersIn

      const result = await repository.findAllWithBalance('user-1');

      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].account).toBeInstanceOf(AccountEntity);
      expect(result[0].balanceCents).toBe(12000);
    });

    it('defaults balance to 0 cents when the account has zero movements — never null', async () => {
      prisma.account.findMany.mockResolvedValue([record]);
      prisma.movement.groupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await repository.findAllWithBalance('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].account).toBeInstanceOf(AccountEntity);
      expect(result[0].balanceCents).toBe(0);
      expect(result[0].balanceCents).not.toBeNull();
    });

    it('moves money out of the source account and into the destination account for a transfer, without counting it as income or expense', async () => {
      prisma.account.findMany.mockResolvedValue([record, accountB]);
      // Call order: non-transfer groupBy, transfersOut groupBy, transfersIn groupBy.
      prisma.movement.groupBy
        .mockResolvedValueOnce([]) // non-transfer sums: none
        .mockResolvedValueOnce([
          {
            accountId: 'acc-1',
            _sum: { amount: { toFixed: () => '200.00' } },
          },
        ]) // transfersOut
        .mockResolvedValueOnce([
          {
            toAccountId: 'acc-2',
            _sum: { amount: { toFixed: () => '200.00' } },
          },
        ]); // transfersIn

      const result = await repository.findAllWithBalance('user-1');

      const balanceByAccountId = new Map(
        result.map((r) => [r.account.id, r.balanceCents]),
      );
      expect(balanceByAccountId.get('acc-1')).toBe(-20000);
      expect(balanceByAccountId.get('acc-2')).toBe(20000);

      // The non-transfer groupBy call must exclude the transfer movement type
      // and scope to this user's own account ids.
      expect(prisma.movement.groupBy).toHaveBeenNthCalledWith(1, {
        by: ['accountId', 'movementType'],
        where: {
          accountId: { in: ['acc-1', 'acc-2'] },
          movementType: { not: 'Transferencia' },
        },
        _sum: { amount: true },
      });
    });
  });

  describe('findByIdWithBalance', () => {
    it('returns null when the account does not exist', async () => {
      prisma.account.findFirst.mockResolvedValue(null);

      const result = await repository.findByIdWithBalance('missing', 'user-1');

      expect(result).toBeNull();
    });

    it('computes the signed balance for a single account, excluding transfers from income/expense', async () => {
      prisma.account.findFirst.mockResolvedValue(record);
      prisma.movement.groupBy.mockResolvedValue([
        {
          movementType: 'Ingreso',
          _sum: { amount: { toFixed: () => '150.00' } },
        },
      ]);
      prisma.movement.aggregate
        .mockResolvedValueOnce({ _sum: { amount: { toFixed: () => '20.00' } } }) // transfersOut
        .mockResolvedValueOnce({
          _sum: { amount: { toFixed: () => '5.00' } },
        }); // transfersIn

      const result = await repository.findByIdWithBalance('acc-1', 'user-1');

      expect(prisma.account.findFirst).toHaveBeenCalledWith({
        where: { id: 'acc-1', userId: 'user-1' },
      });
      expect(prisma.movement.groupBy).toHaveBeenCalledWith({
        by: ['movementType'],
        where: { accountId: 'acc-1', movementType: { not: 'Transferencia' } },
        _sum: { amount: true },
      });
      expect(result?.account).toBeInstanceOf(AccountEntity);
      // 150.00 income - 20.00 sent as transfer + 5.00 received as transfer
      expect(result?.balanceCents).toBe(15000 - 2000 + 500);
    });

    it('defaults to 0 cents when the account has zero movements', async () => {
      prisma.account.findFirst.mockResolvedValue(record);
      prisma.movement.groupBy.mockResolvedValue([]);
      prisma.movement.aggregate.mockResolvedValue({ _sum: { amount: null } });

      const result = await repository.findByIdWithBalance('acc-1', 'user-1');

      expect(result?.balanceCents).toBe(0);
    });
  });
});
