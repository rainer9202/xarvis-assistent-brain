import {
  NotFoundException,
  ValidationException,
} from '@domain/exceptions/domain.exception';
import { ExerciseEntity } from '../../domain/entities/exercise.entity';
import type { ExerciseRepositoryPort } from '../../domain/ports/exercise.repository.port';
import {
  DeleteExerciseCommand,
  DeleteExerciseUseCase,
} from './delete-exercise.use-case';

describe('DeleteExerciseUseCase', () => {
  let findOwnById: jest.Mock;
  let deleteFn: jest.Mock;
  let countRoutineExercisesByExerciseId: jest.Mock;
  let countSessionExercisesByExerciseId: jest.Mock;
  let repository: ExerciseRepositoryPort;
  let useCase: DeleteExerciseUseCase;

  beforeEach(() => {
    findOwnById = jest.fn();
    deleteFn = jest.fn();
    countRoutineExercisesByExerciseId = jest.fn();
    countSessionExercisesByExerciseId = jest.fn();
    repository = {
      findAll: jest.fn(),
      findByIds: jest.fn(),
      findById: jest.fn(),
      findOwnById,
      save: jest.fn(),
      update: jest.fn(),
      delete: deleteFn,
      countRoutineExercisesByExerciseId,
      countSessionExercisesByExerciseId,
    };
    useCase = new DeleteExerciseUseCase(repository);
  });

  it('deletes when there are zero referencing routines and sessions', async () => {
    const entity = new ExerciseEntity({
      id: 'ex-1',
      userId: 'user-1',
      name: 'Custom',
    });
    findOwnById.mockResolvedValue(entity);
    countRoutineExercisesByExerciseId.mockResolvedValue(0);
    countSessionExercisesByExerciseId.mockResolvedValue(0);

    const result = await useCase.execute(
      new DeleteExerciseCommand('ex-1', 'user-1'),
    );

    expect(deleteFn).toHaveBeenCalledWith(entity);
    expect(result).toEqual({ id: 'ex-1' });
  });

  it('throws ValidationException when referenced by a routine', async () => {
    findOwnById.mockResolvedValue(
      new ExerciseEntity({ id: 'ex-1', userId: 'user-1', name: 'Custom' }),
    );
    countRoutineExercisesByExerciseId.mockResolvedValue(1);
    countSessionExercisesByExerciseId.mockResolvedValue(0);

    await expect(
      useCase.execute(new DeleteExerciseCommand('ex-1', 'user-1')),
    ).rejects.toThrow(ValidationException);
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it('throws ValidationException when referenced by a workout session', async () => {
    findOwnById.mockResolvedValue(
      new ExerciseEntity({ id: 'ex-1', userId: 'user-1', name: 'Custom' }),
    );
    countRoutineExercisesByExerciseId.mockResolvedValue(0);
    countSessionExercisesByExerciseId.mockResolvedValue(2);

    await expect(
      useCase.execute(new DeleteExerciseCommand('ex-1', 'user-1')),
    ).rejects.toThrow(ValidationException);
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it('throws NotFoundException for a global exercise (write attempt indistinguishable from missing)', async () => {
    findOwnById.mockResolvedValue(null);

    await expect(
      useCase.execute(new DeleteExerciseCommand('global-ex', 'user-1')),
    ).rejects.toThrow(NotFoundException);
    expect(countRoutineExercisesByExerciseId).not.toHaveBeenCalled();
  });
});
