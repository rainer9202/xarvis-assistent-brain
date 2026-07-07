import { NotFoundException } from '@shared/exceptions/domain.exception';
import { CategoryEntity } from '../../domain/entities/category.entity';
import type { CategoryRepositoryPort } from '../../domain/ports/category.repository.port';
import { GetCategoryByIdUseCase } from './get-category-by-id.use-case';

describe('GetCategoryByIdUseCase', () => {
  let findById: jest.Mock;
  let repository: CategoryRepositoryPort;
  let useCase: GetCategoryByIdUseCase;

  beforeEach(() => {
    findById = jest.fn();
    repository = {
      findAll: jest.fn(),
      findById,
      findByNameAndMovementTypeId: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      countMovementsByCategoryId: jest.fn(),
    };
    useCase = new GetCategoryByIdUseCase(repository);
  });

  it('returns the mapped category when found', async () => {
    findById.mockResolvedValue(
      new CategoryEntity({
        id: 'cat-1',
        name: 'Groceries',
        movementTypeId: 'mt-1',
        userId: 'user-1',
        isActive: true,
      }),
    );

    const result = await useCase.execute('cat-1', 'user-1');

    expect(findById).toHaveBeenCalledWith('cat-1', 'user-1');
    expect(result).toEqual({
      id: 'cat-1',
      name: 'Groceries',
      movementTypeId: 'mt-1',
      isActive: true,
    });
  });

  it('throws NotFoundException when the category does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(useCase.execute('missing', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('wraps unexpected errors from the repository in a plain Error', async () => {
    findById.mockRejectedValue(new Error('connection lost'));

    await expect(useCase.execute('cat-1', 'user-1')).rejects.toThrow(
      'Unexpected error fetching category',
    );
  });
});
