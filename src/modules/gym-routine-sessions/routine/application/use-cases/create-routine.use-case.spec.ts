import {
  ConflictException,
  NotFoundException,
  ValidationException,
} from '@domain/exceptions/domain.exception';
import { RoutineEntity } from '../../domain/entities/routine.entity';
import type { RoutineRepositoryPort } from '../../domain/ports/routine.repository.port';
import {
  CreateRoutineCommand,
  CreateRoutineUseCase,
} from './create-routine.use-case';

describe('CreateRoutineUseCase', () => {
  let findByName: jest.Mock;
  let save: jest.Mock;
  let repository: RoutineRepositoryPort;
  let getExerciseByIdExecute: jest.Mock;
  let useCase: CreateRoutineUseCase;

  beforeEach(() => {
    findByName = jest.fn();
    save = jest.fn();
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByIdWithExercises: jest.fn(),
      findByName,
      save,
      update: jest.fn(),
      delete: jest.fn(),
      countSessionsByRoutineId: jest.fn(),
    };
    getExerciseByIdExecute = jest.fn();
    useCase = new CreateRoutineUseCase(repository, {
      execute: getExerciseByIdExecute,
    } as never);
  });

  const validExercise = {
    exerciseId: 'ex-1',
    targetSets: 4,
    targetReps: 10,
    targetWeightGrams: 20000,
  };

  it('creates a routine, assigning order from array index', async () => {
    findByName.mockResolvedValue(null);
    getExerciseByIdExecute.mockResolvedValue({ id: 'ex-1', name: 'Curl' });
    let savedExercises: unknown;
    save.mockImplementation((entity: RoutineEntity, exercises: unknown) => {
      savedExercises = exercises;
      return Promise.resolve(
        new RoutineEntity({
          id: 'routine-1',
          name: entity.name,
          userId: entity.userId,
          isActive: true,
        }),
      );
    });

    const result = await useCase.execute(
      new CreateRoutineCommand('user-1', 'Pecho', [validExercise]),
    );

    expect(getExerciseByIdExecute).toHaveBeenCalledWith('ex-1', 'user-1');
    expect(savedExercises).toEqual([{ ...validExercise, order: 0 }]);
    expect(result).toEqual({ id: 'routine-1' });
  });

  it('throws ConflictException when the name is already taken', async () => {
    findByName.mockResolvedValue(
      new RoutineEntity({ id: 'routine-1', name: 'Pecho', userId: 'user-1' }),
    );

    await expect(
      useCase.execute(new CreateRoutineCommand('user-1', 'Pecho', [])),
    ).rejects.toThrow(ConflictException);
    expect(save).not.toHaveBeenCalled();
  });

  it('propagates NotFoundException when an exerciseId does not exist', async () => {
    findByName.mockResolvedValue(null);
    getExerciseByIdExecute.mockRejectedValue(
      new NotFoundException('Exercise "ex-missing" not found'),
    );

    await expect(
      useCase.execute(
        new CreateRoutineCommand('user-1', 'Pecho', [
          { ...validExercise, exerciseId: 'ex-missing' },
        ]),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(save).not.toHaveBeenCalled();
  });

  it.each([
    ['targetSets', { ...validExercise, targetSets: 0 }],
    ['targetReps', { ...validExercise, targetReps: 0 }],
    ['targetWeightGrams', { ...validExercise, targetWeightGrams: -1 }],
  ])('throws ValidationException for invalid %s', async (_field, exercise) => {
    findByName.mockResolvedValue(null);

    await expect(
      useCase.execute(new CreateRoutineCommand('user-1', 'Pecho', [exercise])),
    ).rejects.toThrow(ValidationException);
    expect(save).not.toHaveBeenCalled();
  });
});
