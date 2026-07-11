import {
  ConflictException,
  ValidationException,
} from '@domain/exceptions/domain.exception';
import { CategoryEntity } from '../../domain/entities/category.entity';
import type { CategoryRepositoryPort } from '../../domain/ports/category.repository.port';
import {
  CreateCategoryCommand,
  CreateCategoryUseCase,
} from './create-category.use-case';

describe('CreateCategoryUseCase', () => {
  let findByNameAndMovementType: jest.Mock;
  let save: jest.Mock;
  let repository: CategoryRepositoryPort;
  let useCase: CreateCategoryUseCase;

  beforeEach(() => {
    findByNameAndMovementType = jest.fn();
    save = jest.fn();
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByNameAndMovementType,
      save,
      update: jest.fn(),
      delete: jest.fn(),
      countMovementsByCategoryId: jest.fn(),
    };
    useCase = new CreateCategoryUseCase(repository);
  });

  it('creates a category defaulting isActive to true', async () => {
    findByNameAndMovementType.mockResolvedValue(null);
    let savedEntity: CategoryEntity | undefined;
    save.mockImplementation((entity: CategoryEntity) => {
      savedEntity = entity;
      return Promise.resolve(
        new CategoryEntity({
          id: 'cat-1',
          name: entity.name,
          icon: entity.icon,
          movementType: entity.movementType,
          userId: entity.userId,
          isActive: entity.isActive,
        }),
      );
    });

    const result = await useCase.execute(
      new CreateCategoryCommand('Groceries', 'cart-outline', 'MT01', 'user-1'),
    );

    expect(findByNameAndMovementType).toHaveBeenCalledWith(
      'Groceries',
      'MT01',
      'user-1',
    );
    expect(save).toHaveBeenCalledWith(expect.any(CategoryEntity));
    expect(savedEntity?.isActive).toBe(true);
    expect(result).toEqual({ id: 'cat-1' });
  });

  it('throws ValidationException when the movement type is invalid', async () => {
    await expect(
      useCase.execute(
        new CreateCategoryCommand(
          'Groceries',
          'cart-outline',
          'Invalid',
          'user-1',
        ),
      ),
    ).rejects.toThrow(ValidationException);
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects the old label as an invalid movement type code', async () => {
    await expect(
      useCase.execute(
        new CreateCategoryCommand(
          'Groceries',
          'cart-outline',
          'Gasto',
          'user-1',
        ),
      ),
    ).rejects.toThrow(ValidationException);
    expect(save).not.toHaveBeenCalled();
  });

  it('throws ConflictException when a category with the same name already exists under the movement type', async () => {
    findByNameAndMovementType.mockResolvedValue(
      new CategoryEntity({
        id: 'cat-1',
        name: 'Groceries',
        icon: 'cart-outline',
        movementType: 'MT01',
        userId: 'user-1',
        isActive: true,
      }),
    );

    await expect(
      useCase.execute(
        new CreateCategoryCommand(
          'Groceries',
          'cart-outline',
          'MT01',
          'user-1',
        ),
      ),
    ).rejects.toThrow(ConflictException);
    expect(save).not.toHaveBeenCalled();
  });
});
