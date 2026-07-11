import {
  ConflictException,
  NotFoundException,
  ValidationException,
} from '@domain/exceptions/domain.exception';
import { CategoryEntity } from '../../domain/entities/category.entity';
import type { CategoryRepositoryPort } from '../../domain/ports/category.repository.port';
import {
  UpdateCategoryCommand,
  UpdateCategoryUseCase,
} from './update-category.use-case';

describe('UpdateCategoryUseCase', () => {
  let findById: jest.Mock;
  let findByNameAndMovementType: jest.Mock;
  let update: jest.Mock;
  let repository: CategoryRepositoryPort;
  let useCase: UpdateCategoryUseCase;

  beforeEach(() => {
    findById = jest.fn();
    findByNameAndMovementType = jest.fn();
    update = jest.fn();
    repository = {
      findAll: jest.fn(),
      findById,
      findByNameAndMovementType,
      save: jest.fn(),
      update,
      delete: jest.fn(),
      countMovementsByCategoryId: jest.fn(),
    };
    useCase = new UpdateCategoryUseCase(repository);
  });

  it('applies only the provided fields, leaving the rest unchanged', async () => {
    const existing = new CategoryEntity({
      id: 'cat-1',
      name: 'Groceries',
      icon: 'cart-outline',
      movementType: 'MT01',
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
    expect(findByNameAndMovementType).toHaveBeenCalledWith(
      'Supermarket',
      'MT01',
      'user-1',
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Supermarket',
        movementType: 'MT01',
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

  it('revalidates the movement type when movementType is provided, throwing ValidationException on an invalid value', async () => {
    const existing = new CategoryEntity({
      id: 'cat-1',
      name: 'Groceries',
      icon: 'cart-outline',
      movementType: 'MT01',
      userId: 'user-1',
      isActive: true,
    });
    findById.mockResolvedValue(existing);

    await expect(
      useCase.execute(
        new UpdateCategoryCommand(
          'cat-1',
          'user-1',
          undefined,
          undefined,
          'Invalid',
        ),
      ),
    ).rejects.toThrow(ValidationException);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects the old label as an invalid movement type code', async () => {
    const existing = new CategoryEntity({
      id: 'cat-1',
      name: 'Groceries',
      icon: 'cart-outline',
      movementType: 'MT01',
      userId: 'user-1',
      isActive: true,
    });
    findById.mockResolvedValue(existing);

    await expect(
      useCase.execute(
        new UpdateCategoryCommand(
          'cat-1',
          'user-1',
          undefined,
          undefined,
          'Gasto',
        ),
      ),
    ).rejects.toThrow(ValidationException);
    expect(update).not.toHaveBeenCalled();
  });

  it('throws ConflictException when the new name/movementType collides with another category', async () => {
    const existing = new CategoryEntity({
      id: 'cat-1',
      name: 'Groceries',
      icon: 'cart-outline',
      movementType: 'MT01',
      userId: 'user-1',
      isActive: true,
    });
    findById.mockResolvedValue(existing);
    findByNameAndMovementType.mockResolvedValue(
      new CategoryEntity({
        id: 'cat-2',
        name: 'Supermarket',
        icon: 'cart-outline',
        movementType: 'MT01',
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
      icon: 'cart-outline',
      movementType: 'MT01',
      userId: 'user-1',
      isActive: true,
    });
    findById.mockResolvedValue(existing);
    findByNameAndMovementType.mockResolvedValue(existing);
    update.mockImplementation((entity: CategoryEntity) =>
      Promise.resolve(entity),
    );

    const result = await useCase.execute(
      new UpdateCategoryCommand('cat-1', 'user-1', 'Groceries'),
    );

    expect(result).toEqual({ id: 'cat-1' });
  });

  it('does not re-check uniqueness when neither name nor movementType changes', async () => {
    const existing = new CategoryEntity({
      id: 'cat-1',
      name: 'Groceries',
      icon: 'cart-outline',
      movementType: 'MT01',
      userId: 'user-1',
      isActive: true,
    });
    findById.mockResolvedValue(existing);
    update.mockImplementation((entity: CategoryEntity) =>
      Promise.resolve(entity),
    );

    const result = await useCase.execute(
      new UpdateCategoryCommand(
        'cat-1',
        'user-1',
        undefined,
        undefined,
        undefined,
        false,
      ),
    );

    expect(findByNameAndMovementType).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'cat-1' });
  });
});
