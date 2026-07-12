import { AccountEntity } from '../../domain/entities/account.entity';
import type { AccountRepositoryPort } from '../../domain/ports/account.repository.port';
import { GetAllAccountsUseCase } from './get-all-accounts.use-case';

describe('GetAllAccountsUseCase', () => {
  let repository: jest.Mocked<AccountRepositoryPort>;
  let useCase: GetAllAccountsUseCase;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      countMovementsByAccountId: jest.fn(),
      findAllWithBalance: jest.fn(),
      findByIdWithBalance: jest.fn(),
      countByUserId: jest.fn(),
      setPrincipal: jest.fn(),
    };
    useCase = new GetAllAccountsUseCase(repository);
  });

  it('maps repository balance data (signed sum) to the response shape', async () => {
    const createdAt = new Date('2024-01-01T00:00:00Z');
    const account = new AccountEntity({
      id: 'acc-1',
      name: 'Main Checking',
      type: 'AT02',
      userId: 'user-1',
      isActive: true,
      isPrincipal: true,
      createdAt,
    });
    repository.findAllWithBalance.mockResolvedValue([
      { account, balanceCents: 4500 },
    ]);

    const result = await useCase.execute('user-1');

    expect(repository.findAllWithBalance).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([
      {
        id: 'acc-1',
        name: 'Main Checking',
        type: 'AT02',
        typeLabel: 'Débito',
        isActive: true,
        isPrincipal: true,
        creditLimitCents: null,
        balanceCents: 4500,
        createdAt,
      },
    ]);
  });

  it('includes creditLimitCents when present on the account', async () => {
    const account = new AccountEntity({
      id: 'acc-1',
      name: 'Credit Card',
      type: 'AT03',
      userId: 'user-1',
      isActive: true,
      isPrincipal: false,
      creditLimitCents: 50000000,
      createdAt: new Date('2024-01-01T00:00:00Z'),
    });
    repository.findAllWithBalance.mockResolvedValue([
      { account, balanceCents: -10000 },
    ]);

    const result = await useCase.execute('user-1');

    expect(result[0].creditLimitCents).toBe(50000000);
  });

  it('defaults balance to 0 cents when the account has zero movements, never null', async () => {
    const account = new AccountEntity({
      id: 'acc-2',
      name: 'Empty Wallet',
      type: 'AT01',
      userId: 'user-1',
      isActive: true,
      createdAt: new Date('2024-01-01T00:00:00Z'),
    });
    repository.findAllWithBalance.mockResolvedValue([
      { account, balanceCents: 0 },
    ]);

    const result = await useCase.execute('user-1');

    expect(result[0].balanceCents).toBe(0);
    expect(result[0].balanceCents).not.toBeNull();
  });

  it('returns an empty array when there are no accounts', async () => {
    repository.findAllWithBalance.mockResolvedValue([]);

    const result = await useCase.execute('user-1');

    expect(result).toEqual([]);
  });

  it('falls back typeLabel to the raw code when no label matches', async () => {
    const account = new AccountEntity({
      id: 'acc-3',
      name: 'Unknown Type Account',
      type: 'AT99',
      userId: 'user-1',
      isActive: true,
      createdAt: new Date('2024-01-01T00:00:00Z'),
    });
    repository.findAllWithBalance.mockResolvedValue([
      { account, balanceCents: 0 },
    ]);

    const result = await useCase.execute('user-1');

    expect(result[0].typeLabel).toBe('AT99');
  });
});
