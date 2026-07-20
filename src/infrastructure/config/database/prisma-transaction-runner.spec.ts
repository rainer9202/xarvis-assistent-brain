// PrismaService itself is mocked before any other import so that requiring
// `PrismaTransactionRunner` never pulls in the real generated Prisma client
// (ts-jest does not auto-hoist jest.mock() the way babel-jest does, so this
// call must stay above the imports it affects) — mirrors the identical
// pattern in every prisma-*.repository.spec.ts.
jest.mock('./prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { PrismaTransactionRunner } from './prisma-transaction-runner';
import type { PrismaService } from './prisma.service';

describe('PrismaTransactionRunner', () => {
  let runner: PrismaTransactionRunner;
  let prisma: {
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
    };
    runner = new PrismaTransactionRunner(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('invokes this.prisma.$transaction with a callback and returns its resolved value', async () => {
    const fakeTxClient = { fake: 'tx-client' };
    prisma.$transaction.mockImplementation(
      async (fn: (client: unknown) => Promise<unknown>) => fn(fakeTxClient),
    );
    const work = jest.fn().mockResolvedValue('unit-of-work-result');

    const result = await runner.run(work);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(work).toHaveBeenCalledWith(fakeTxClient);
    expect(result).toBe('unit-of-work-result');
  });

  it('propagates a throw from the work callback (rollback contract) instead of swallowing it', async () => {
    const failure = new Error('insert failed mid-transaction');
    prisma.$transaction.mockImplementation(
      async (fn: (client: unknown) => Promise<unknown>) => fn({}),
    );
    const work = jest.fn().mockRejectedValue(failure);

    await expect(runner.run(work)).rejects.toThrow(
      'insert failed mid-transaction',
    );
  });
});
