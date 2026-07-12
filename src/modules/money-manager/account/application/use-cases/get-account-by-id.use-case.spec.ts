import { NotFoundException } from '@domain/exceptions/domain.exception';
import { AccountEntity } from '../../domain/entities/account.entity';
import type { AccountRepositoryPort } from '../../domain/ports/account.repository.port';
import { GetAccountByIdUseCase } from './get-account-by-id.use-case';

describe('GetAccountByIdUseCase', () => {
  let findByIdWithBalance: jest.Mock;
  let repository: AccountRepositoryPort;
  let useCase: GetAccountByIdUseCase;

  beforeEach(() => {
    findByIdWithBalance = jest.fn();
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      countMovementsByAccountId: jest.fn(),
      findAllWithBalance: jest.fn(),
      findByIdWithBalance,
      countByUserId: jest.fn(),
      setPrincipal: jest.fn(),
    };
    useCase = new GetAccountByIdUseCase(repository);
  });

  it('returns the mapped account with balance when found', async () => {
    findByIdWithBalance.mockResolvedValue({
      account: new AccountEntity({
        id: 'acc-1',
        name: 'Main Checking',
        type: 'AT02',
        userId: 'user-1',
        isActive: true,
        isPrincipal: true,
        createdAt: new Date('2024-01-01T00:00:00Z'),
      }),
      balanceCents: 5000,
    });

    const result = await useCase.execute('acc-1', 'user-1');

    expect(findByIdWithBalance).toHaveBeenCalledWith('acc-1', 'user-1');
    expect(result).toEqual({
      id: 'acc-1',
      name: 'Main Checking',
      type: 'AT02',
      typeLabel: 'Débito',
      isActive: true,
      isPrincipal: true,
      creditLimitCents: null,
      balanceCents: 5000,
      createdAt: new Date('2024-01-01T00:00:00Z'),
    });
  });

  it('includes creditLimitCents when present on the account', async () => {
    findByIdWithBalance.mockResolvedValue({
      account: new AccountEntity({
        id: 'acc-1',
        name: 'Credit Card',
        type: 'AT03',
        userId: 'user-1',
        isActive: true,
        isPrincipal: false,
        creditLimitCents: 50000000,
        createdAt: new Date('2024-01-01T00:00:00Z'),
      }),
      balanceCents: -10000,
    });

    const result = await useCase.execute('acc-1', 'user-1');

    expect(result.creditLimitCents).toBe(50000000);
  });

  it('throws NotFoundException when the account does not exist', async () => {
    findByIdWithBalance.mockResolvedValue(null);

    await expect(useCase.execute('missing', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('wraps unexpected errors from the repository in a plain Error', async () => {
    findByIdWithBalance.mockRejectedValue(new Error('connection lost'));

    await expect(useCase.execute('acc-1', 'user-1')).rejects.toThrow(
      'Unexpected error fetching account',
    );
  });

  it('falls back typeLabel to the raw code when no label matches', async () => {
    findByIdWithBalance.mockResolvedValue({
      account: new AccountEntity({
        id: 'acc-1',
        name: 'Main Checking',
        type: 'AT99',
        userId: 'user-1',
        isActive: true,
        isPrincipal: true,
        createdAt: new Date('2024-01-01T00:00:00Z'),
      }),
      balanceCents: 0,
    });

    const result = await useCase.execute('acc-1', 'user-1');

    expect(result.typeLabel).toBe('AT99');
  });
});
