import {
  ConflictException,
  NotFoundException,
} from '@shared/exceptions/domain.exception';
import { CategoryEntity } from '../../domain/entities/category.entity';
import type { CategoryRepositoryPort } from '../../domain/ports/category.repository.port';
import type { GetMovementTypeByIdUseCase } from '@modules/money-manager/movement-type/application/use-cases/get-movement-type-by-id.use-case';
import {
  UpdateCategoryCommand,
  UpdateCategoryUseCase,
} from './update-category.use-case';

describe('UpdateCategoryUseCase', () => {
  let findById: jest.Mock;
  let findByNameAndMovementTypeId: jest.Mock;
  let update: jest.Mock;
  let repository: CategoryRepositoryPort;
  let getMovementTypeByIdExecute: jest.Mock;
  let getMovementTypeById: GetMovementTypeByIdUseCase;
  let useCase: UpdateCategoryUseCase;

  beforeEach(() => {
    findById = jest.fn();
    findByNameAndMovementTypeId = jest.fn();
    update = jest.fn();
    repository = {
      findAll: jest.fn(),
      findById,
      findByNameAndMovementTypeId,
      save: jest.fn(),
      update,
      delete: jest.fn(),
      countMovementsByCategoryId: jest.fn(),
    };
    getMovementTypeByIdExecute = jest.fn();
    getMovementTypeById = {
      execute: getMovementTypeByIdExecute,
    } as unknown as GetMovementTypeByIdUseCase;
    useCase = new UpdateCategoryUseCase(repository, getMovementTypeById);
  });

  it('applies only the provided fields, leaving the rest unchanged', async () => {
    const existing = new CategoryEntity({
      id: 'cat-1',
      name: 'Groceries',
      movementTypeId: 'mt-1',
      userId: 'user-1',
      isActive: true,
    });
    findById.mockResolvedValue(existing);
    update.mockImplementation((entity: CategoryEntity) =>
      Promise.resolve(entity),
    );

    const result = await useCase.execute(
      new UpdateCategoryCommand('cat-1', 'user-1', 'Supermarket'),
    );

    expect(findById).toHaveBeenCalledWith('cat-1', 'user-1');
    expect(findByNameAndMovementTypeId).toHaveBeenCalledWith(
      'Supermarket',
      'mt-1',
      'user-1',
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Supermarket',
        movementTypeId: 'mt-1',
        isActive: true,
      }),
    );
    expect(result).toEqual({ id: 'cat-1' });
  });

  it('throws NotFoundException when the category does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(
      useCase.execute(
        new UpdateCategoryCommand('missing', 'user-1', 'Supermarket'),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });

  it('revalidates the movement type when movementTypeId is provided, propagating NotFoundException', async () => {
    const existing = new CategoryEntity({
      id: 'cat-1',
      name: 'Groceries',
      movementTypeId: 'mt-1',
      userId: 'user-1',
      isActive: true,
    });
    findById.mockResolvedValue(existing);
    getMovementTypeByIdExecute.mockRejectedValue(
      new NotFoundException('Movement type "missing" not found'),
    );

    await expect(
      useCase.execute(
        new UpdateCategoryCommand('cat-1', 'user-1', undefined, 'missing'),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });

  it('throws ConflictException when the new name/movementTypeId collides with another category', async () => {
    const existing = new CategoryEntity({
      id: 'cat-1',
      name: 'Groceries',
      movementTypeId: 'mt-1',
      userId: 'user-1',
      isActive: true,
    });
    findById.mockResolvedValue(existing);
    findByNameAndMovementTypeId.mockResolvedValue(
      new CategoryEntity({
        id: 'cat-2',
        name: 'Supermarket',
        movementTypeId: 'mt-1',
        userId: 'user-1',
        isActive: true,
      }),
    );

    await expect(
      useCase.execute(
        new UpdateCategoryCommand('cat-1', 'user-1', 'Supermarket'),
      ),
    ).rejects.toThrow(ConflictException);
    expect(update).not.toHaveBeenCalled();
  });

  it('does not throw when the uniqueness check matches the same record being updated', async () => {
    const existing = new CategoryEntity({
      id: 'cat-1',
      name: 'Groceries',
      movementTypeId: 'mt-1',
      userId: 'user-1',
      isActive: true,
    });
    findById.mockResolvedValue(existing);
    findByNameAndMovementTypeId.mockResolvedValue(existing);
    update.mockImplementation((entity: CategoryEntity) =>
      Promise.resolve(entity),
    );

    const result = await useCase.execute(
      new UpdateCategoryCommand('cat-1', 'user-1', 'Groceries'),
    );

    expect(result).toEqual({ id: 'cat-1' });
  });

  it('does not re-check uniqueness when neither name nor movementTypeId changes', async () => {
    const existing = new CategoryEntity({
      id: 'cat-1',
      name: 'Groceries',
      movementTypeId: 'mt-1',
      userId: 'user-1',
      isActive: true,
    });
    findById.mockResolvedValue(existing);
    update.mockImplementation((entity: CategoryEntity) =>
      Promise.resolve(entity),
    );

    const result = await useCase.execute(
      new UpdateCategoryCommand('cat-1', 'user-1', undefined, undefined, false),
    );

    expect(findByNameAndMovementTypeId).not.toHaveBeenCalled();
    expect(getMovementTypeByIdExecute).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'cat-1' });
  });
});
