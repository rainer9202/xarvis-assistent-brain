import { NotFoundException } from '@domain/exceptions/domain.exception';
import { WorkoutSessionEntity } from '../../domain/entities/workout-session.entity';
import { WorkoutSessionExerciseEntity } from '../../domain/entities/workout-session-exercise.entity';
import type { WorkoutSessionRepositoryPort } from '../../domain/ports/workout-session.repository.port';
import type { WorkoutSessionExerciseRepositoryPort } from '../../domain/ports/workout-session-exercise.repository.port';
import {
  DeleteWorkoutSessionExerciseCommand,
  DeleteWorkoutSessionExerciseUseCase,
} from './delete-workout-session-exercise.use-case';

describe('DeleteWorkoutSessionExerciseUseCase', () => {
  let entryFindById: jest.Mock;
  let deleteFn: jest.Mock;
  let sessionFindById: jest.Mock;
  let sessionRepository: WorkoutSessionRepositoryPort;
  let repository: WorkoutSessionExerciseRepositoryPort;
  let useCase: DeleteWorkoutSessionExerciseUseCase;

  beforeEach(() => {
    entryFindById = jest.fn();
    deleteFn = jest.fn();
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
      update: jest.fn(),
      delete: deleteFn,
    };
    useCase = new DeleteWorkoutSessionExerciseUseCase(
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

  it('deletes after a successful two-hop ownership check', async () => {
    const e = entry();
    entryFindById.mockResolvedValue(e);
    sessionFindById.mockResolvedValue(
      new WorkoutSessionEntity({
        id: 'session-1',
        userId: 'user-1',
        routineId: 'routine-1',
        date: new Date(),
      }),
    );

    const result = await useCase.execute(
      new DeleteWorkoutSessionExerciseCommand('wse-1', 'user-1'),
    );

    expect(deleteFn).toHaveBeenCalledWith(e);
    expect(result).toEqual({ id: 'wse-1' });
  });

  it("throws NotFoundException when the parent session isn't owned by this user", async () => {
    entryFindById.mockResolvedValue(entry());
    sessionFindById.mockResolvedValue(null);

    await expect(
      useCase.execute(
        new DeleteWorkoutSessionExerciseCommand('wse-1', 'other-user'),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the entry does not exist', async () => {
    entryFindById.mockResolvedValue(null);

    await expect(
      useCase.execute(
        new DeleteWorkoutSessionExerciseCommand('missing', 'user-1'),
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
