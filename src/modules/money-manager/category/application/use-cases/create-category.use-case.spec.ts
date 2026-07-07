import {
  ConflictException,
  NotFoundException,
} from '@shared/exceptions/domain.exception';
import { CategoryEntity } from '../../domain/entities/category.entity';
import type { CategoryRepositoryPort } from '../../domain/ports/category.repository.port';
import type { GetMovementTypeByIdUseCase } from '@modules/money-manager/movement-type/application/use-cases/get-movement-type-by-id.use-case';
import {
  CreateCategoryCommand,
  CreateCategoryUseCase,
} from './create-category.use-case';

describe('CreateCategoryUseCase', () => {
  let findByNameAndMovementTypeId: jest.Mock;
  let save: jest.Mock;
  let repository: CategoryRepositoryPort;
  let getMovementTypeByIdExecute: jest.Mock;
  let getMovementTypeById: GetMovementTypeByIdUseCase;
  let useCase: CreateCategoryUseCase;

  beforeEach(() => {
    findByNameAndMovementTypeId = jest.fn();
    save = jest.fn();
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByNameAndMovementTypeId,
      save,
      update: jest.fn(),
      delete: jest.fn(),
      countMovementsByCategoryId: jest.fn(),
    };
    getMovementTypeByIdExecute = jest.fn();
    getMovementTypeById = {
      execute: getMovementTypeByIdExecute,
    } as unknown as GetMovementTypeByIdUseCase;
    useCase = new CreateCategoryUseCase(repository, getMovementTypeById);
  });

  it('creates a category defaulting isActive to true', async () => {
    getMovementTypeByIdExecute.mockResolvedValue({
      id: 'mt-1',
      name: 'expense',
      isDefault: true,
    });
    findByNameAndMovementTypeId.mockResolvedValue(null);
    let savedEntity: CategoryEntity | undefined;
    save.mockImplementation((entity: CategoryEntity) => {
      savedEntity = entity;
      return Promise.resolve(
        new CategoryEntity({
          id: 'cat-1',
          name: entity.name,
          movementTypeId: entity.movementTypeId,
          isActive: entity.isActive,
        }),
      );
    });

    const result = await useCase.execute(
      new CreateCategoryCommand('Groceries', 'mt-1', 'user-1'),
    );

    expect(getMovementTypeByIdExecute).toHaveBeenCalledWith('mt-1');
    expect(findByNameAndMovementTypeId).toHaveBeenCalledWith(
      'Groceries',
      'mt-1',
      'user-1',
    );
    expect(save).toHaveBeenCalledWith(expect.any(CategoryEntity));
    expect(savedEntity?.isActive).toBe(true);
    expect(result).toEqual({ id: 'cat-1' });
  });

  it('throws NotFoundException when the movement type does not exist', async () => {
    getMovementTypeByIdExecute.mockRejectedValue(
      new NotFoundException('Movement type "missing" not found'),
    );

    await expect(
      useCase.execute(
        new CreateCategoryCommand('Groceries', 'missing', 'user-1'),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(save).not.toHaveBeenCalled();
  });

  it('throws ConflictException when a category with the same name already exists under the movement type', async () => {
    getMovementTypeByIdExecute.mockResolvedValue({
      id: 'mt-1',
      name: 'expense',
      isDefault: true,
    });
    findByNameAndMovementTypeId.mockResolvedValue(
      new CategoryEntity({
        id: 'cat-1',
        name: 'Groceries',
        movementTypeId: 'mt-1',
        userId: 'user-1',
        isActive: true,
      }),
    );

    await expect(
      useCase.execute(new CreateCategoryCommand('Groceries', 'mt-1', 'user-1')),
    ).rejects.toThrow(ConflictException);
    expect(save).not.toHaveBeenCalled();
  });
});
