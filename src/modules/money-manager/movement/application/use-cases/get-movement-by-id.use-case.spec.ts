import { NotFoundException } from '@domain/exceptions/domain.exception';
import { MovementEntity } from '../../domain/entities/movement.entity';
import type { MovementRepositoryPort } from '../../domain/ports/movement.repository.port';
import type { GetCategoryByIdUseCase } from '@modules/money-manager/category/application/use-cases/get-category-by-id.use-case';
import type { GetGroupByIdUseCase } from '@modules/money-manager/group/application/use-cases/get-group-by-id.use-case';
import { GetMovementByIdUseCase } from './get-movement-by-id.use-case';

describe('GetMovementByIdUseCase', () => {
  let findById: jest.Mock;
  let repository: MovementRepositoryPort;
  let getCategoryById: jest.Mocked<GetCategoryByIdUseCase>;
  let getGroupByIdExecute: jest.Mock;
  let getGroupById: jest.Mocked<GetGroupByIdUseCase>;
  let useCase: GetMovementByIdUseCase;

  beforeEach(() => {
    findById = jest.fn();
    repository = {
      findAll: jest.fn(),
      findById,
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    getCategoryById = {
      execute: jest.fn().mockResolvedValue({
        id: 'cat-1',
        name: 'Groceries',
        movementType: 'MT01',
        movementTypeLabel: 'Gasto',
        isActive: true,
      }),
    } as unknown as jest.Mocked<GetCategoryByIdUseCase>;
    getGroupByIdExecute = jest.fn();
    getGroupById = {
      execute: getGroupByIdExecute,
    } as unknown as jest.Mocked<GetGroupByIdUseCase>;
    useCase = new GetMovementByIdUseCase(
      repository,
      getCategoryById,
      getGroupById,
    );
  });

  it('returns the mapped movement when found', async () => {
    findById.mockResolvedValue(
      new MovementEntity({
        id: 'mv-1',
        amountCents: 15000,
        date: new Date('2024-01-01T00:00:00Z'),
        note: 'Groceries',
        accountId: 'acc-1',
        toAccountId: undefined,
        categoryId: 'cat-1',
        movementType: 'MT01',
        userId: 'user-1',
        createdAt: new Date('2024-01-01T00:00:00Z'),
      }),
    );

    const result = await useCase.execute('mv-1', 'user-1');

    expect(findById).toHaveBeenCalledWith('mv-1', 'user-1');
    expect(getCategoryById.execute).toHaveBeenCalledWith('cat-1', 'user-1');
    expect(getGroupByIdExecute).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: 'mv-1',
      amountCents: 15000,
      date: new Date('2024-01-01T00:00:00Z'),
      note: 'Groceries',
      accountId: 'acc-1',
      toAccountId: undefined,
      categoryId: 'cat-1',
      categoryLabel: 'Groceries',
      movementType: 'MT01',
      movementTypeLabel: 'Gasto',
      groupId: undefined,
      groupLabel: undefined,
      createdAt: new Date('2024-01-01T00:00:00Z'),
    });
  });

  it('resolves groupId and groupLabel when the movement belongs to a group', async () => {
    findById.mockResolvedValue(
      new MovementEntity({
        id: 'mv-1',
        amountCents: 15000,
        date: new Date('2024-01-01T00:00:00Z'),
        accountId: 'acc-1',
        categoryId: 'cat-1',
        movementType: 'MT01',
        groupId: 'grp-1',
        userId: 'user-1',
        createdAt: new Date('2024-01-01T00:00:00Z'),
      }),
    );
    getGroupByIdExecute.mockResolvedValue({
      id: 'grp-1',
      name: 'Fixed Expenses',
      isActive: true,
    });

    const result = await useCase.execute('mv-1', 'user-1');

    expect(getGroupByIdExecute).toHaveBeenCalledWith('grp-1', 'user-1');
    expect(result.groupId).toBe('grp-1');
    expect(result.groupLabel).toBe('Fixed Expenses');
  });

  it('falls back movementTypeLabel to the raw code when no label matches', async () => {
    findById.mockResolvedValue(
      new MovementEntity({
        id: 'mv-1',
        amountCents: 15000,
        date: new Date('2024-01-01T00:00:00Z'),
        accountId: 'acc-1',
        categoryId: 'cat-1',
        movementType: 'MT99',
        userId: 'user-1',
        createdAt: new Date('2024-01-01T00:00:00Z'),
      }),
    );

    const result = await useCase.execute('mv-1', 'user-1');

    expect(result.movementTypeLabel).toBe('MT99');
  });

  it('throws NotFoundException when the movement does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(useCase.execute('missing', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('wraps unexpected errors from the repository in a plain Error', async () => {
    findById.mockRejectedValue(new Error('connection lost'));

    await expect(useCase.execute('mv-1', 'user-1')).rejects.toThrow(
      'Unexpected error fetching movement',
    );
  });
});
