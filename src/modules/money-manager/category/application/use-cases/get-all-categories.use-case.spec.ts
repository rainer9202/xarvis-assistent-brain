import { CategoryEntity } from '../../domain/entities/category.entity';
import type { CategoryRepositoryPort } from '../../domain/ports/category.repository.port';
import { GetAllCategoriesUseCase } from './get-all-categories.use-case';

describe('GetAllCategoriesUseCase', () => {
  let repository: jest.Mocked<CategoryRepositoryPort>;
  let useCase: GetAllCategoriesUseCase;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByNameAndMovementType: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      countMovementsByCategoryId: jest.fn(),
    };
    useCase = new GetAllCategoriesUseCase(repository);
  });

  it('maps repository entities to the response shape', async () => {
    const createdAt = new Date('2024-01-01T00:00:00Z');
    const entity = new CategoryEntity({
      id: 'cat-1',
      name: 'Groceries',
      movementType: 'MT01',
      userId: 'user-1',
      isActive: true,
      createdAt,
    });
    repository.findAll.mockResolvedValue([entity]);

    const result = await useCase.execute('user-1');

    expect(repository.findAll).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([
      {
        id: 'cat-1',
        name: 'Groceries',
        movementType: 'MT01',
        movementTypeLabel: 'Gasto',
        isActive: true,
        createdAt,
      },
    ]);
  });

  it('falls back movementTypeLabel to the raw code when no label matches', async () => {
    const entity = new CategoryEntity({
      id: 'cat-1',
      name: 'Groceries',
      movementType: 'MT99',
      userId: 'user-1',
      isActive: true,
    });
    repository.findAll.mockResolvedValue([entity]);

    const result = await useCase.execute('user-1');

    expect(result[0].movementTypeLabel).toBe('MT99');
  });

  it('returns an empty array when there are no categories', async () => {
    repository.findAll.mockResolvedValue([]);

    const result = await useCase.execute('user-1');

    expect(result).toEqual([]);
  });
});
