import { MovementEntity } from '../../domain/entities/movement.entity';
import type { MovementRepositoryPort } from '../../domain/ports/movement.repository.port';
import type { GetAllCategoriesUseCase } from '@modules/money-manager/category/application/use-cases/get-all-categories.use-case';
import type { GetAllGroupsUseCase } from '@modules/money-manager/group/application/use-cases/get-all-groups.use-case';
import { GetAllMovementsUseCase } from './get-all-movements.use-case';

describe('GetAllMovementsUseCase', () => {
  let repository: jest.Mocked<MovementRepositoryPort>;
  let getAllCategories: jest.Mocked<GetAllCategoriesUseCase>;
  let getAllGroups: jest.Mocked<GetAllGroupsUseCase>;
  let useCase: GetAllMovementsUseCase;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    getAllCategories = {
      execute: jest.fn().mockResolvedValue([
        {
          id: 'cat-1',
          name: 'Groceries',
          movementType: 'MT01',
          movementTypeLabel: 'Gasto',
          isActive: true,
          createdAt: new Date('2024-01-01T00:00:00Z'),
        },
      ]),
    } as unknown as jest.Mocked<GetAllCategoriesUseCase>;
    getAllGroups = {
      execute: jest.fn().mockResolvedValue([
        {
          id: 'grp-1',
          name: 'Fixed Expenses',
          isActive: true,
          createdAt: new Date('2024-01-01T00:00:00Z'),
        },
      ]),
    } as unknown as jest.Mocked<GetAllGroupsUseCase>;
    useCase = new GetAllMovementsUseCase(
      repository,
      getAllCategories,
      getAllGroups,
    );
  });

  it('maps repository entities to the response shape', async () => {
    const createdAt = new Date('2024-01-01T00:00:00Z');
    const date = new Date('2024-01-02T00:00:00Z');
    const entity = new MovementEntity({
      id: 'mov-1',
      amountCents: 1500,
      date,
      note: 'Weekly groceries',
      accountId: 'acc-1',
      categoryId: 'cat-1',
      movementType: 'MT01',
      userId: 'user-1',
      createdAt,
    });
    repository.findAll.mockResolvedValue([entity]);

    const result = await useCase.execute('user-1');

    expect(repository.findAll).toHaveBeenCalledWith('user-1', undefined);
    expect(result).toEqual([
      {
        id: 'mov-1',
        amountCents: 1500,
        date,
        note: 'Weekly groceries',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        categoryLabel: 'Groceries',
        movementType: 'MT01',
        movementTypeLabel: 'Gasto',
        groupId: undefined,
        groupLabel: undefined,
        createdAt,
      },
    ]);
  });

  it('resolves groupLabel when a groupId is set, and falls back to the raw id when unmatched', async () => {
    const createdAt = new Date('2024-01-01T00:00:00Z');
    const date = new Date('2024-01-02T00:00:00Z');
    repository.findAll.mockResolvedValue([
      new MovementEntity({
        id: 'mov-1',
        amountCents: 1500,
        date,
        accountId: 'acc-1',
        categoryId: 'cat-1',
        movementType: 'MT01',
        groupId: 'grp-1',
        userId: 'user-1',
        createdAt,
      }),
      new MovementEntity({
        id: 'mov-2',
        amountCents: 1500,
        date,
        accountId: 'acc-1',
        categoryId: 'cat-1',
        movementType: 'MT01',
        groupId: 'grp-unknown',
        userId: 'user-1',
        createdAt,
      }),
    ]);

    const result = await useCase.execute('user-1');

    expect(result[0].groupId).toBe('grp-1');
    expect(result[0].groupLabel).toBe('Fixed Expenses');
    expect(result[1].groupId).toBe('grp-unknown');
    expect(result[1].groupLabel).toBe('grp-unknown');
  });

  it('falls back movementTypeLabel to the raw code when no label matches', async () => {
    const createdAt = new Date('2024-01-01T00:00:00Z');
    const date = new Date('2024-01-02T00:00:00Z');
    const entity = new MovementEntity({
      id: 'mov-1',
      amountCents: 1500,
      date,
      accountId: 'acc-1',
      categoryId: 'cat-1',
      movementType: 'MT99',
      userId: 'user-1',
      createdAt,
    });
    repository.findAll.mockResolvedValue([entity]);

    const result = await useCase.execute('user-1');

    expect(result[0].movementTypeLabel).toBe('MT99');
  });

  it('falls back categoryLabel to the raw id when no category matches', async () => {
    const createdAt = new Date('2024-01-01T00:00:00Z');
    const date = new Date('2024-01-02T00:00:00Z');
    const entity = new MovementEntity({
      id: 'mov-1',
      amountCents: 1500,
      date,
      accountId: 'acc-1',
      categoryId: 'cat-unknown',
      movementType: 'MT01',
      userId: 'user-1',
      createdAt,
    });
    repository.findAll.mockResolvedValue([entity]);

    const result = await useCase.execute('user-1');

    expect(result[0].categoryLabel).toBe('cat-unknown');
    expect(getAllCategories.execute).toHaveBeenCalledWith('user-1');
  });

  it('includes toAccountId for a transfer movement', async () => {
    const createdAt = new Date('2024-01-01T00:00:00Z');
    const date = new Date('2024-01-02T00:00:00Z');
    const entity = new MovementEntity({
      id: 'mov-2',
      amountCents: 20000,
      date,
      accountId: 'acc-1',
      toAccountId: 'acc-2',
      categoryId: 'cat-1',
      movementType: 'MT03',
      userId: 'user-1',
      createdAt,
    });
    repository.findAll.mockResolvedValue([entity]);

    const result = await useCase.execute('user-1');

    expect(result[0].toAccountId).toBe('acc-2');
  });

  it('returns an empty array when there are no movements', async () => {
    repository.findAll.mockResolvedValue([]);

    const result = await useCase.execute('user-1');

    expect(result).toEqual([]);
  });
});
