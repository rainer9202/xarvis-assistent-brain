import {
  NotFoundException,
  ValidationException,
} from '@domain/exceptions/domain.exception';
import { WorkoutSessionEntity } from '../../domain/entities/workout-session.entity';
import { WorkoutSessionExerciseEntity } from '../../domain/entities/workout-session-exercise.entity';
import type { WorkoutSessionRepositoryPort } from '../../domain/ports/workout-session.repository.port';
import type { WorkoutSessionExerciseRepositoryPort } from '../../domain/ports/workout-session-exercise.repository.port';
import {
  CreateWorkoutSessionExerciseCommand,
  CreateWorkoutSessionExerciseUseCase,
} from './create-workout-session-exercise.use-case';

describe('CreateWorkoutSessionExerciseUseCase', () => {
  let sessionFindById: jest.Mock;
  let save: jest.Mock;
  let sessionRepository: WorkoutSessionRepositoryPort;
  let repository: WorkoutSessionExerciseRepositoryPort;
  let getExerciseByIdExecute: jest.Mock;
  let useCase: CreateWorkoutSessionExerciseUseCase;

  const command = new CreateWorkoutSessionExerciseCommand(
    'session-1',
    'user-1',
    'ex-1',
    3,
    12,
    18000,
  );

  beforeEach(() => {
    sessionFindById = jest.fn();
    save = jest.fn();
    sessionRepository = {
      findAll: jest.fn(),
      findById: sessionFindById,
      findByIdWithExercises: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    repository = {
      findById: jest.fn(),
      save,
      update: jest.fn(),
      delete: jest.fn(),
    };
    getExerciseByIdExecute = jest.fn();
    useCase = new CreateWorkoutSessionExerciseUseCase(
      sessionRepository,
      repository,
      { execute: getExerciseByIdExecute } as never,
    );
  });

  it('creates a log entry on an unfinished session', async () => {
    sessionFindById.mockResolvedValue(
      new WorkoutSessionEntity({
        id: 'session-1',
        userId: 'user-1',
        routineId: 'routine-1',
        date: new Date(),
        finishedAt: null,
      }),
    );
    getExerciseByIdExecute.mockResolvedValue({
      id: 'ex-1',
      name: 'Bench Press',
    });
    save.mockImplementation((entity: WorkoutSessionExerciseEntity) =>
      Promise.resolve(
        new WorkoutSessionExerciseEntity({ id: 'wse-1', ...entity }),
      ),
    );

    const result = await useCase.execute(command);

    expect(sessionFindById).toHaveBeenCalledWith('session-1', 'user-1');
    expect(getExerciseByIdExecute).toHaveBeenCalledWith('ex-1', 'user-1');
    expect(result).toEqual({ id: 'wse-1' });
  });

  it('throws ValidationException when creating on a finished session', async () => {
    sessionFindById.mockResolvedValue(
      new WorkoutSessionEntity({
        id: 'session-1',
        userId: 'user-1',
        routineId: 'routine-1',
        date: new Date(),
        finishedAt: new Date(),
      }),
    );

    await expect(useCase.execute(command)).rejects.toThrow(ValidationException);
    expect(save).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the session is missing/not owned', async () => {
    sessionFindById.mockResolvedValue(null);

    await expect(useCase.execute(command)).rejects.toThrow(NotFoundException);
    expect(save).not.toHaveBeenCalled();
  });

  it('throws ValidationException for invalid bounds', async () => {
    sessionFindById.mockResolvedValue(
      new WorkoutSessionEntity({
        id: 'session-1',
        userId: 'user-1',
        routineId: 'routine-1',
        date: new Date(),
        finishedAt: null,
      }),
    );
    getExerciseByIdExecute.mockResolvedValue({
      id: 'ex-1',
      name: 'Bench Press',
    });

    await expect(
      useCase.execute(
        new CreateWorkoutSessionExerciseCommand(
          'session-1',
          'user-1',
          'ex-1',
          0,
          12,
          18000,
        ),
      ),
    ).rejects.toThrow(ValidationException);
    expect(save).not.toHaveBeenCalled();
  });
});
