import {
  NotFoundException,
  ValidationException,
} from '@domain/exceptions/domain.exception';
import { CategoryEntity } from '../../domain/entities/category.entity';
import type { CategoryRepositoryPort } from '../../domain/ports/category.repository.port';
import {
  DeleteCategoryCommand,
  DeleteCategoryUseCase,
} from './delete-category.use-case';

describe('DeleteCategoryUseCase', () => {
  let findOwnById: jest.Mock;
  let deleteFn: jest.Mock;
  let countMovementsByCategoryId: jest.Mock;
  let repository: CategoryRepositoryPort;
  let useCase: DeleteCategoryUseCase;

  beforeEach(() => {
    findOwnById = jest.fn();
    deleteFn = jest.fn();
    countMovementsByCategoryId = jest.fn();
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findOwnById,
      findByNameAndMovementType: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: deleteFn,
      countMovementsByCategoryId,
    };
    useCase = new DeleteCategoryUseCase(repository);
  });

  it('deletes the category when there are zero referencing movements', async () => {
    const entity = new CategoryEntity({
      id: 'cat-1',
      name: 'Groceries',
      movementType: 'MT01',
      userId: 'user-1',
      isActive: true,
    });
    findOwnById.mockResolvedValue(entity);
    countMovementsByCategoryId.mockResolvedValue(0);
    deleteFn.mockResolvedValue(undefined);

    const result = await useCase.execute(
      new DeleteCategoryCommand('cat-1', 'user-1'),
    );

    expect(countMovementsByCategoryId).toHaveBeenCalledWith('cat-1');
    expect(deleteFn).toHaveBeenCalledWith(entity);
    expect(result).toEqual({ id: 'cat-1' });
  });

  it('throws ValidationException and does not delete when referenced by a movement', async () => {
    const entity = new CategoryEntity({
      id: 'cat-1',
      name: 'Groceries',
      movementType: 'MT01',
      userId: 'user-1',
      isActive: true,
    });
    findOwnById.mockResolvedValue(entity);
    countMovementsByCategoryId.mockResolvedValue(2);

    await expect(
      useCase.execute(new DeleteCategoryCommand('cat-1', 'user-1')),
    ).rejects.toThrow(ValidationException);
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the category does not exist', async () => {
    findOwnById.mockResolvedValue(null);

    await expect(
      useCase.execute(new DeleteCategoryCommand('missing', 'user-1')),
    ).rejects.toThrow(NotFoundException);
    expect(countMovementsByCategoryId).not.toHaveBeenCalled();
  });
});
