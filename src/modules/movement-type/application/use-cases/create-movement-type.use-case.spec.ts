import { ConflictException } from '@shared/exceptions/domain.exception';
import { MovementTypeEntity } from '../../domain/entities/movement-type.entity';
import type { MovementTypeRepositoryPort } from '../../domain/ports/movement-type.repository.port';
import {
  CreateMovementTypeCommand,
  CreateMovementTypeUseCase,
} from './create-movement-type.use-case';

describe('CreateMovementTypeUseCase', () => {
  let findByName: jest.Mock;
  let save: jest.Mock;
  let repository: MovementTypeRepositoryPort;
  let useCase: CreateMovementTypeUseCase;

  beforeEach(() => {
    findByName = jest.fn();
    save = jest.fn();
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByName,
      save,
      delete: jest.fn(),
    };
    useCase = new CreateMovementTypeUseCase(repository);
  });

  it('creates a movement type when the name does not already exist', async () => {
    findByName.mockResolvedValue(null);
    let savedEntity: MovementTypeEntity | undefined;
    save.mockImplementation((entity: MovementTypeEntity) => {
      savedEntity = entity;
      return Promise.resolve(entity);
    });

    const result = await useCase.execute(
      new CreateMovementTypeCommand('expense'),
    );

    expect(findByName).toHaveBeenCalledWith('expense');
    expect(save).toHaveBeenCalledWith(expect.any(MovementTypeEntity));
    expect(savedEntity?.name).toBe('expense');
    expect(result).toEqual({ name: 'expense' });
  });

  it('throws ConflictException when the name already exists', async () => {
    findByName.mockResolvedValue(
      new MovementTypeEntity({ id: 'mt-1', name: 'expense' }),
    );

    await expect(
      useCase.execute(new CreateMovementTypeCommand('expense')),
    ).rejects.toThrow(ConflictException);
    expect(save).not.toHaveBeenCalled();
  });

  it('wraps unexpected errors from the repository in a plain Error', async () => {
    findByName.mockRejectedValue(new Error('connection lost'));

    await expect(
      useCase.execute(new CreateMovementTypeCommand('expense')),
    ).rejects.toThrow('Unexpected error creating movement type');
    expect(save).not.toHaveBeenCalled();
  });
});
