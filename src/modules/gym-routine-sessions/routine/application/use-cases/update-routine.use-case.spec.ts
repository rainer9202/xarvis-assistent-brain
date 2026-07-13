import {
  ConflictException,
  NotFoundException,
  ValidationException,
} from '@domain/exceptions/domain.exception';
import { RoutineEntity } from '../../domain/entities/routine.entity';
import type { RoutineRepositoryPort } from '../../domain/ports/routine.repository.port';
import {
  UpdateRoutineCommand,
  UpdateRoutineUseCase,
} from './update-routine.use-case';

describe('UpdateRoutineUseCase', () => {
  let findById: jest.Mock;
  let findByName: jest.Mock;
  let update: jest.Mock;
  let repository: RoutineRepositoryPort;
  let getExerciseByIdExecute: jest.Mock;
  let useCase: UpdateRoutineUseCase;

  beforeEach(() => {
    findById = jest.fn();
    findByName = jest.fn();
    update = jest.fn();
    repository = {
      findAll: jest.fn(),
      findById,
      findByIdWithExercises: jest.fn(),
      findByName,
      save: jest.fn(),
      update,
      delete: jest.fn(),
      countSessionsByRoutineId: jest.fn(),
    };
    getExerciseByIdExecute = jest.fn();
    useCase = new UpdateRoutineUseCase(repository, {
      execute: getExerciseByIdExecute,
    } as never);
  });

  const existingRoutine = () =>
    new RoutineEntity({
      id: 'routine-1',
      name: 'Pecho',
      userId: 'user-1',
      isActive: true,
    });

  it('omitting exercises leaves the existing exercise list untouched', async () => {
    findById.mockResolvedValue(existingRoutine());
    update.mockImplementation((entity: RoutineEntity) =>
      Promise.resolve(entity),
    );

    await useCase.execute(new UpdateRoutineCommand('routine-1', 'user-1'));

    expect(update).toHaveBeenCalledWith(expect.any(RoutineEntity), undefined);
    expect(getExerciseByIdExecute).not.toHaveBeenCalled();
  });

  it('an empty array clears all exercises (full replace with zero items)', async () => {
    findById.mockResolvedValue(existingRoutine());
    update.mockImplementation((entity: RoutineEntity) =>
      Promise.resolve(entity),
    );

    await useCase.execute(
      new UpdateRoutineCommand('routine-1', 'user-1', undefined, undefined, []),
    );

    expect(update).toHaveBeenCalledWith(expect.any(RoutineEntity), []);
  });

  it('a provided array fully replaces the exercise list, re-validating existence and bounds', async () => {
    findById.mockResolvedValue(existingRoutine());
    getExerciseByIdExecute.mockResolvedValue({ id: 'ex-2', name: 'Press' });
    let savedExercises: unknown;
    update.mockImplementation((entity: RoutineEntity, exercises: unknown) => {
      savedExercises = exercises;
      return Promise.resolve(entity);
    });

    await useCase.execute(
      new UpdateRoutineCommand('routine-1', 'user-1', undefined, undefined, [
        {
          exerciseId: 'ex-2',
          targetSets: 3,
          targetReps: 8,
          targetWeightGrams: 15000,
        },
      ]),
    );

    expect(getExerciseByIdExecute).toHaveBeenCalledWith('ex-2', 'user-1');
    expect(savedExercises).toEqual([
      {
        exerciseId: 'ex-2',
        order: 0,
        targetSets: 3,
        targetReps: 8,
        targetWeightGrams: 15000,
      },
    ]);
  });

  it('throws ValidationException for invalid bounds when exercises is provided', async () => {
    findById.mockResolvedValue(existingRoutine());

    await expect(
      useCase.execute(
        new UpdateRoutineCommand('routine-1', 'user-1', undefined, undefined, [
          {
            exerciseId: 'ex-2',
            targetSets: 0,
            targetReps: 8,
            targetWeightGrams: 15000,
          },
        ]),
      ),
    ).rejects.toThrow(ValidationException);
    expect(update).not.toHaveBeenCalled();
  });

  it('re-checks name uniqueness when name changes', async () => {
    findById.mockResolvedValue(existingRoutine());
    findByName.mockResolvedValue(
      new RoutineEntity({
        id: 'other-routine',
        name: 'Taken',
        userId: 'user-1',
      }),
    );

    await expect(
      useCase.execute(new UpdateRoutineCommand('routine-1', 'user-1', 'Taken')),
    ).rejects.toThrow(ConflictException);
    expect(update).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the routine does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(
      useCase.execute(new UpdateRoutineCommand('missing', 'user-1')),
    ).rejects.toThrow(NotFoundException);
  });
});
