import { CategoryEntity } from '../../domain/entities/category.entity';
import type { CategoryRepositoryPort } from '../../domain/ports/category.repository.port';
import type { TransactionContext } from '@domain/ports/transaction-runner.port';
import { DEFAULT_CATEGORIES } from '../../domain/default-categories';
import { ProvisionDefaultCategoriesUseCase } from './provision-default-categories.use-case';

describe('ProvisionDefaultCategoriesUseCase', () => {
  let save: jest.Mock<
    Promise<CategoryEntity>,
    [CategoryEntity, TransactionContext?]
  >;
  let repository: CategoryRepositoryPort;
  let useCase: ProvisionDefaultCategoriesUseCase;

  beforeEach(() => {
    save = jest
      .fn<Promise<CategoryEntity>, [CategoryEntity, TransactionContext?]>()
      .mockImplementation((entity: CategoryEntity) => Promise.resolve(entity));
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findOwnById: jest.fn(),
      findByNameAndMovementType: jest.fn(),
      save,
      update: jest.fn(),
      delete: jest.fn(),
      countMovementsByCategoryId: jest.fn(),
    };
    useCase = new ProvisionDefaultCategoriesUseCase(repository);
  });

  it('creates exactly 15 categories from the shared DEFAULT_CATEGORIES constant', async () => {
    await useCase.execute('user-1');

    expect(save).toHaveBeenCalledTimes(DEFAULT_CATEGORIES.length);
    expect(DEFAULT_CATEGORIES.length).toBe(15);
  });

  it('creates each category owned by the given userId, matching name/icon/movementType', async () => {
    await useCase.execute('user-1');

    const savedEntities = save.mock.calls.map(([entity]) => entity);
    for (const [index, defaultCategory] of DEFAULT_CATEGORIES.entries()) {
      expect(savedEntities[index].userId).toBe('user-1');
      expect(savedEntities[index].name).toBe(defaultCategory.name);
      expect(savedEntities[index].icon).toBe(defaultCategory.icon);
      expect(savedEntities[index].movementType).toBe(
        defaultCategory.movementType,
      );
    }
  });

  it('passes the tx through to every repository.save call', async () => {
    const tx = { fakeTx: true };

    await useCase.execute('user-1', tx);

    expect(save).toHaveBeenCalledTimes(DEFAULT_CATEGORIES.length);
    for (const call of save.mock.calls) {
      expect(call[1]).toBe(tx);
    }
  });
});
