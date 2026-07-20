import { GroupEntity } from '../../domain/entities/group.entity';
import type { GroupRepositoryPort } from '../../domain/ports/group.repository.port';
import type { TransactionContext } from '@domain/ports/transaction-runner.port';
import { DEFAULT_GROUPS } from '../../domain/default-groups';
import { ProvisionDefaultGroupsUseCase } from './provision-default-groups.use-case';

describe('ProvisionDefaultGroupsUseCase', () => {
  let save: jest.Mock<Promise<GroupEntity>, [GroupEntity, TransactionContext?]>;
  let repository: GroupRepositoryPort;
  let useCase: ProvisionDefaultGroupsUseCase;

  beforeEach(() => {
    save = jest
      .fn<Promise<GroupEntity>, [GroupEntity, TransactionContext?]>()
      .mockImplementation((entity: GroupEntity) => Promise.resolve(entity));
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      save,
      update: jest.fn(),
      delete: jest.fn(),
    };
    useCase = new ProvisionDefaultGroupsUseCase(repository);
  });

  it('creates exactly 2 groups for the given userId', async () => {
    await useCase.execute('user-1');

    expect(save).toHaveBeenCalledTimes(DEFAULT_GROUPS.length);
    expect(DEFAULT_GROUPS.length).toBe(2);
  });

  it('creates Casa and Gastos Hormigas with no budgetCents', async () => {
    await useCase.execute('user-1');

    const savedEntities = save.mock.calls.map(([entity]) => entity);
    const names = savedEntities.map((entity) => entity.name);
    expect(names).toEqual(['Casa', 'Gastos Hormigas']);
    for (const entity of savedEntities) {
      expect(entity.userId).toBe('user-1');
      expect(entity.budgetCents).toBeUndefined();
    }
  });

  it('passes the tx through to every repository.save call', async () => {
    const tx = { fakeTx: true };

    await useCase.execute('user-1', tx);

    expect(save).toHaveBeenCalledTimes(DEFAULT_GROUPS.length);
    for (const call of save.mock.calls) {
      expect(call[1]).toBe(tx);
    }
  });
});
