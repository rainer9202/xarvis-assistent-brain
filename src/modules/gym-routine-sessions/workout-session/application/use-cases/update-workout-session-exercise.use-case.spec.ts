import {
  NotFoundException,
  ValidationException,
} from '@domain/exceptions/domain.exception';
import { WorkoutSessionEntity } from '../../domain/entities/workout-session.entity';
import { WorkoutSessionExerciseEntity } from '../../domain/entities/workout-session-exercise.entity';
import type { WorkoutSessionRepositoryPort } from '../../domain/ports/workout-session.repository.port';
import type { WorkoutSessionExerciseRepositoryPort } from '../../domain/ports/workout-session-exercise.repository.port';
import {
  UpdateWorkoutSessionExerciseCommand,
  UpdateWorkoutSessionExerciseUseCase,
} from './update-workout-session-exercise.use-case';

describe('UpdateWorkoutSessionExerciseUseCase', () => {
  let entryFindById: jest.Mock;
  let update: jest.Mock;
  let sessionFindById: jest.Mock;
  let sessionRepository: WorkoutSessionRepositoryPort;
  let repository: WorkoutSessionExerciseRepositoryPort;
  let useCase: UpdateWorkoutSessionExerciseUseCase;

  beforeEach(() => {
    entryFindById = jest.fn();
    update = jest.fn();
    sessionFindById = jest.fn();
    sessionRepository = {
      findAll: jest.fn(),
      findById: sessionFindById,
      findByIdWithExercises: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    repository = {
      findById: entryFindById,
      save: jest.fn(),
      update,
      delete: jest.fn(),
    };
    useCase = new UpdateWorkoutSessionExerciseUseCase(
      sessionRepository,
      repository,
    );
  });

  const entry = () =>
    new WorkoutSessionExerciseEntity({
      id: 'wse-1',
      workoutSessionId: 'session-1',
      exerciseId: 'ex-1',
      actualSets: 3,
      actualReps: 10,
      actualWeightGrams: 18000,
    });

  it('allows an update even on a finished session (only creation is gated)', async () => {
    entryFindById.mockResolvedValue(entry());
    sessionFindById.mockResolvedValue(
      new WorkoutSessionEntity({
        id: 'session-1',
        userId: 'user-1',
        routineId: 'routine-1',
        date: new Date(),
        finishedAt: new Date(),
      }),
    );
    update.mockImplementation((e: WorkoutSessionExerciseEntity) =>
      Promise.resolve(e),
    );

    const result = await useCase.execute(
      new UpdateWorkoutSessionExerciseCommand('wse-1', 'user-1', 4),
    );

    expect(result).toEqual({ id: 'wse-1' });
  });

  it('two-hop ownership check: throws NotFoundException when the parent session is not owned', async () => {
    entryFindById.mockResolvedValue(entry());
    sessionFindById.mockResolvedValue(null);

    await expect(
      useCase.execute(
        new UpdateWorkoutSessionExerciseCommand('wse-1', 'other-user', 4),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the entry itself does not exist', async () => {
    entryFindById.mockResolvedValue(null);

    await expect(
      useCase.execute(
        new UpdateWorkoutSessionExerciseCommand('missing', 'user-1', 4),
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('re-validates bounds when a field is provided', async () => {
    entryFindById.mockResolvedValue(entry());
    sessionFindById.mockResolvedValue(
      new WorkoutSessionEntity({
        id: 'session-1',
        userId: 'user-1',
        routineId: 'routine-1',
        date: new Date(),
        finishedAt: null,
      }),
    );

    await expect(
      useCase.execute(
        new UpdateWorkoutSessionExerciseCommand('wse-1', 'user-1', 0),
      ),
    ).rejects.toThrow(ValidationException);
    expect(update).not.toHaveBeenCalled();
  });
});
