import { AccountEntity } from '../../domain/entities/account.entity';
import type { AccountRepositoryPort } from '../../domain/ports/account.repository.port';
import type { TransactionContext } from '@domain/ports/transaction-runner.port';
import { ProvisionDefaultAccountsUseCase } from './provision-default-accounts.use-case';

describe('ProvisionDefaultAccountsUseCase', () => {
  let save: jest.Mock<
    Promise<AccountEntity>,
    [AccountEntity, TransactionContext?]
  >;
  let repository: AccountRepositoryPort;
  let useCase: ProvisionDefaultAccountsUseCase;

  beforeEach(() => {
    save = jest
      .fn<Promise<AccountEntity>, [AccountEntity, TransactionContext?]>()
      .mockImplementation((entity: AccountEntity) => Promise.resolve(entity));
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      save,
      update: jest.fn(),
      delete: jest.fn(),
      countMovementsByAccountId: jest.fn(),
      findAllWithBalance: jest.fn(),
      findByIdWithBalance: jest.fn(),
      countByUserId: jest.fn(),
      setPrincipal: jest.fn(),
    };
    useCase = new ProvisionDefaultAccountsUseCase(repository);
  });

  it('creates exactly 3 accounts for the given userId', async () => {
    await useCase.execute('user-1');

    expect(save).toHaveBeenCalledTimes(3);
  });

  it('creates Principal (AT02) explicitly isPrincipal:true, not via inference', async () => {
    await useCase.execute('user-1');

    const principalCall = save.mock.calls.find(
      ([entity]) => entity.name === 'Principal',
    );
    expect(principalCall).toBeDefined();
    const [principalEntity] = principalCall!;
    expect(principalEntity.type).toBe('AT02');
    expect(principalEntity.isPrincipal).toBe(true);
    expect(principalEntity.userId).toBe('user-1');
  });

  it('creates Ahorro (AT04) and Efectivo (AT01) with isPrincipal:false', async () => {
    await useCase.execute('user-1');

    const ahorroCall = save.mock.calls.find(
      ([entity]) => entity.name === 'Ahorro',
    );
    const efectivoCall = save.mock.calls.find(
      ([entity]) => entity.name === 'Efectivo',
    );
    expect(ahorroCall).toBeDefined();
    expect(efectivoCall).toBeDefined();
    const [ahorroEntity] = ahorroCall!;
    const [efectivoEntity] = efectivoCall!;
    expect(ahorroEntity.type).toBe('AT04');
    expect(ahorroEntity.isPrincipal).toBe(false);
    expect(efectivoEntity.type).toBe('AT01');
    expect(efectivoEntity.isPrincipal).toBe(false);
  });

  it('passes the tx through to every repository.save call', async () => {
    const tx = { fakeTx: true };

    await useCase.execute('user-1', tx);

    expect(save).toHaveBeenCalledTimes(3);
    for (const call of save.mock.calls) {
      expect(call[1]).toBe(tx);
    }
  });
});
