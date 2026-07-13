import {
  NotFoundException,
  ValidationException,
} from '@domain/exceptions/domain.exception';
import { RoutineEntity } from '../../domain/entities/routine.entity';
import type { RoutineRepositoryPort } from '../../domain/ports/routine.repository.port';
import {
  DeleteRoutineCommand,
  DeleteRoutineUseCase,
} from './delete-routine.use-case';

describe('DeleteRoutineUseCase', () => {
  let findById: jest.Mock;
  let deleteFn: jest.Mock;
  let countSessionsByRoutineId: jest.Mock;
  let repository: RoutineRepositoryPort;
  let useCase: DeleteRoutineUseCase;

  beforeEach(() => {
    findById = jest.fn();
    deleteFn = jest.fn();
    countSessionsByRoutineId = jest.fn();
    repository = {
      findAll: jest.fn(),
      findById,
      findByIdWithExercises: jest.fn(),
      findByName: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: deleteFn,
      countSessionsByRoutineId,
    };
    useCase = new DeleteRoutineUseCase(repository);
  });

  it('deletes when there are zero referencing workout sessions', async () => {
    const entity = new RoutineEntity({
      id: 'routine-1',
      name: 'Pecho',
      userId: 'user-1',
    });
    findById.mockResolvedValue(entity);
    countSessionsByRoutineId.mockResolvedValue(0);

    const result = await useCase.execute(
      new DeleteRoutineCommand('routine-1', 'user-1'),
    );

    expect(deleteFn).toHaveBeenCalledWith(entity);
    expect(result).toEqual({ id: 'routine-1' });
  });

  it('throws ValidationException when referenced by a workout session', async () => {
    findById.mockResolvedValue(
      new RoutineEntity({ id: 'routine-1', name: 'Pecho', userId: 'user-1' }),
    );
    countSessionsByRoutineId.mockResolvedValue(1);

    await expect(
      useCase.execute(new DeleteRoutineCommand('routine-1', 'user-1')),
    ).rejects.toThrow(ValidationException);
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when not found', async () => {
    findById.mockResolvedValue(null);

    await expect(
      useCase.execute(new DeleteRoutineCommand('missing', 'user-1')),
    ).rejects.toThrow(NotFoundException);
  });
});
