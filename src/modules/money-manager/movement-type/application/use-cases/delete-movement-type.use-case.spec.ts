import {
  NotFoundException,
  ValidationException,
} from '@shared/exceptions/domain.exception';
import { MovementTypeEntity } from '../../domain/entities/movement-type.entity';
import type { MovementTypeRepositoryPort } from '../../domain/ports/movement-type.repository.port';
import {
  DeleteMovementTypeCommand,
  DeleteMovementTypeUseCase,
} from './delete-movement-type.use-case';

describe('DeleteMovementTypeUseCase', () => {
  let findById: jest.Mock;
  let deleteEntity: jest.Mock;
  let countCategoriesByMovementTypeId: jest.Mock;
  let countMovementsByMovementTypeId: jest.Mock;
  let repository: MovementTypeRepositoryPort;
  let useCase: DeleteMovementTypeUseCase;

  beforeEach(() => {
    findById = jest.fn();
    deleteEntity = jest.fn();
    countCategoriesByMovementTypeId = jest.fn().mockResolvedValue(0);
    countMovementsByMovementTypeId = jest.fn().mockResolvedValue(0);
    repository = {
      findAll: jest.fn(),
      findById,
      findByName: jest.fn(),
      save: jest.fn(),
      delete: deleteEntity,
      countCategoriesByMovementTypeId,
      countMovementsByMovementTypeId,
    };
    useCase = new DeleteMovementTypeUseCase(repository);
  });

  it('deletes a non-default movement type with zero references', async () => {
    const entity = new MovementTypeEntity({
      id: 'mt-1',
      name: 'expense',
      isDefault: false,
    });
    findById.mockResolvedValue(entity);

    const result = await useCase.execute(new DeleteMovementTypeCommand('mt-1'));

    expect(findById).toHaveBeenCalledWith('mt-1');
    expect(deleteEntity).toHaveBeenCalledWith(entity);
    expect(result).toEqual({ id: 'mt-1' });
  });

  it('throws ValidationException and does not delete when referenced by a category', async () => {
    const entity = new MovementTypeEntity({
      id: 'mt-1',
      name: 'expense',
      isDefault: false,
    });
    findById.mockResolvedValue(entity);
    countCategoriesByMovementTypeId.mockResolvedValue(1);

    await expect(
      useCase.execute(new DeleteMovementTypeCommand('mt-1')),
    ).rejects.toThrow(ValidationException);
    expect(deleteEntity).not.toHaveBeenCalled();
  });

  it('throws ValidationException and does not delete when referenced by a movement', async () => {
    const entity = new MovementTypeEntity({
      id: 'mt-1',
      name: 'expense',
      isDefault: false,
    });
    findById.mockResolvedValue(entity);
    countMovementsByMovementTypeId.mockResolvedValue(1);

    await expect(
      useCase.execute(new DeleteMovementTypeCommand('mt-1')),
    ).rejects.toThrow(ValidationException);
    expect(deleteEntity).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the movement type does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(
      useCase.execute(new DeleteMovementTypeCommand('missing')),
    ).rejects.toThrow(NotFoundException);
    expect(deleteEntity).not.toHaveBeenCalled();
  });

  it('throws ValidationException when the movement type is a default one', async () => {
    const entity = new MovementTypeEntity({
      id: 'mt-1',
      name: 'expense',
      isDefault: true,
    });
    findById.mockResolvedValue(entity);

    await expect(
      useCase.execute(new DeleteMovementTypeCommand('mt-1')),
    ).rejects.toThrow(ValidationException);
    expect(deleteEntity).not.toHaveBeenCalled();
  });

  it('wraps unexpected errors from the repository in a plain Error', async () => {
    findById.mockRejectedValue(new Error('connection lost'));

    await expect(
      useCase.execute(new DeleteMovementTypeCommand('mt-1')),
    ).rejects.toThrow('Unexpected error deleting movement type');
  });
});
