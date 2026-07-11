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
      updateMany: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
    };
    movement: {
      count: jest.Mock;
      groupBy: jest.Mock;
      aggregate: jest.Mock;
    };
    $transaction: jest.Mock<Promise<unknown[]>, [unknown[]]>;
  };

  const record = {
    id: 'acc-1',
    name: 'Main Checking',
    type: 'AT02',
    userId: 'user-1',
    isActive: true,
    isPrincipal: false,
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
        updateMany: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      movement: {
        count: jest.fn(),
        groupBy: jest.fn(),
        aggregate: jest.fn(),
      },
      $transaction: jest.fn<Promise<unknown[]>, [unknown[]]>(),
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
      expect(result?.type).toBe('AT02');
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
        type: 'AT02',
        userId: 'user-1',
        isActive: true,
        isPrincipal: true,
      });
      prisma.account.create.mockResolvedValue(record);

      const result = await repository.save(entity);

      expect(prisma.account.create).toHaveBeenCalledWith({
        data: {
          id: undefined,
          name: 'Main Checking',
          type: 'AT02',
          userId: 'user-1',
          isActive: true,
          isPrincipal: true,
        },
      });
      expect(result).toBeInstanceOf(AccountEntity);
      expect(result.name).toBe('Main Checking');
    });

    // Closes the TOCTOU race in CreateAccountUseCase: two concurrent
    // first-account creations for the same user can both compute
    // isPrincipal: true before either commits. The DB's partial unique
    // index (accounts_user_id_principal_unique) lets only one through; the
    // loser's create() throws P2002, which save() catches and retries as a
    // non-principal account instead of failing the request outright.
    it('retries as non-principal when the principal-uniqueness index rejects a concurrent isPrincipal:true insert', async () => {
      const entity = new AccountEntity({
        name: 'Main Checking',
        type: 'AT02',
        userId: 'user-1',
        isActive: true,
        isPrincipal: true,
      });
      prisma.account.create
        .mockRejectedValueOnce(
          Object.assign(
            new Error('Unique constraint failed on the fields: (`user_id`)'),
            { code: 'P2002', meta: { target: ['user_id'] } },
          ),
        )
        .mockResolvedValueOnce({ ...record, isPrincipal: false });

      const result = await repository.save(entity);

      expect(prisma.account.create).toHaveBeenCalledTimes(2);
      expect(prisma.account.create).toHaveBeenNthCalledWith(2, {
        data: {
          id: undefined,
          name: 'Main Checking',
          type: 'AT02',
          userId: 'user-1',
          isActive: true,
          isPrincipal: false,
        },
      });
      expect(result.isPrincipal).toBe(false);
    });

    it('rethrows a P2002 unrelated to the principal race unchanged when isPrincipal was not requested', async () => {
      const entity = new AccountEntity({
        name: 'Main Checking',
        type: 'AT02',
        userId: 'user-1',
        isActive: true,
        isPrincipal: false,
      });
      const conflict = Object.assign(new Error('conflict'), {
        code: 'P2002',
      });
      prisma.account.create.mockRejectedValue(conflict);

      await expect(repository.save(entity)).rejects.toThrow('conflict');
      expect(prisma.account.create).toHaveBeenCalledTimes(1);
    });

    it('rethrows any other error unchanged', async () => {
      const entity = new AccountEntity({
        name: 'Main Checking',
        type: 'AT02',
        userId: 'user-1',
        isActive: true,
        isPrincipal: true,
      });
      const unexpected = new Error('connection refused');
      prisma.account.create.mockRejectedValue(unexpected);

      await expect(repository.save(entity)).rejects.toThrow(
        'connection refused',
      );
      expect(prisma.account.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('update', () => {
    it('updates a record from the entity and returns the mapped entity', async () => {
      const entity = new AccountEntity({
        id: 'acc-1',
        name: 'Savings',
        type: 'AT02',
        userId: 'user-1',
        isActive: false,
        isPrincipal: false,
      });
      prisma.account.update.mockResolvedValue({
        ...record,
        name: 'Savings',
        isActive: false,
      });

      const result = await repository.update(entity);

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: {
          name: 'Savings',
          type: 'AT02',
          isActive: false,
          isPrincipal: false,
        },
      });
      expect(result.name).toBe('Savings');
      expect(result.isActive).toBe(false);
    });
  });

  describe('countByUserId', () => {
    it('delegates to prisma.account.count scoped to the user', async () => {
      prisma.account.count.mockResolvedValue(2);

      const result = await repository.countByUserId('user-1');

      expect(prisma.account.count).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(result).toBe(2);
    });
  });

  describe('setPrincipal', () => {
    it('atomically unsets the previous principal and sets the new one in a single transaction', async () => {
      prisma.$transaction.mockResolvedValue([{ count: 1 }, record]);

      await repository.setPrincipal('acc-1', 'user-1');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.account.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isPrincipal: true, id: { not: 'acc-1' } },
        data: { isPrincipal: false },
      });
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { isPrincipal: true },
      });
      // Both statements must be passed into the same $transaction([...]) call
      // rather than awaited separately, so they run atomically.
      const [transactionArg] = prisma.$transaction.mock.calls[0];
      expect(transactionArg).toHaveLength(2);
    });
  });

  describe('delete', () => {
    it('deletes the record by id', async () => {
      const entity = new AccountEntity({
        id: 'acc-1',
        name: 'Main Checking',
        type: 'AT02',
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
