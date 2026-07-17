import { NotFoundException } from '@domain/exceptions/domain.exception';
import type { WorkoutSessionExerciseRepositoryPort } from '../../domain/ports/workout-session-exercise.repository.port';
import { GetExerciseProgressUseCase } from './get-exercise-progress.use-case';

describe('GetExerciseProgressUseCase', () => {
  let findLoggedEntriesForExercise: jest.Mock;
  let repository: WorkoutSessionExerciseRepositoryPort;
  let getExerciseByIdExecute: jest.Mock;
  let useCase: GetExerciseProgressUseCase;

  beforeEach(() => {
    findLoggedEntriesForExercise = jest.fn();
    repository = {
      findById: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findLoggedEntriesForExercise,
    };
    getExerciseByIdExecute = jest.fn();
    useCase = new GetExerciseProgressUseCase(
      { execute: getExerciseByIdExecute } as never,
      repository,
    );
  });

  it('gates on visibility first, then returns entries mapped and ordered as returned by the repository', async () => {
    getExerciseByIdExecute.mockResolvedValue({
      id: 'ex-1',
      name: 'Bench Press',
    });
    findLoggedEntriesForExercise.mockResolvedValue([
      {
        sessionId: 'session-1',
        sessionDate: new Date('2024-01-01T00:00:00Z'),
        routineId: 'routine-1',
        routineName: 'Push Day',
        actualSets: 4,
        actualReps: 10,
        actualWeightGrams: 18000,
      },
      {
        sessionId: 'session-2',
        sessionDate: new Date('2024-02-01T00:00:00Z'),
        routineId: 'routine-1',
        routineName: 'Push Day',
        actualSets: 4,
        actualReps: 8,
        actualWeightGrams: 20000,
      },
    ]);

    const result = await useCase.execute('ex-1', 'user-1');

    expect(getExerciseByIdExecute).toHaveBeenCalledWith('ex-1', 'user-1');
    expect(findLoggedEntriesForExercise).toHaveBeenCalledWith('ex-1', 'user-1');
    expect(result).toEqual([
      {
        sessionId: 'session-1',
        sessionDate: new Date('2024-01-01T00:00:00Z'),
        routineId: 'routine-1',
        routineName: 'Push Day',
        actualSets: 4,
        actualReps: 10,
        actualWeightGrams: 18000,
      },
      {
        sessionId: 'session-2',
        sessionDate: new Date('2024-02-01T00:00:00Z'),
        routineId: 'routine-1',
        routineName: 'Push Day',
        actualSets: 4,
        actualReps: 8,
        actualWeightGrams: 20000,
      },
    ]);
  });

  it('returns an empty array when the exercise is visible but was never logged', async () => {
    getExerciseByIdExecute.mockResolvedValue({ id: 'ex-1', name: 'Squat' });
    findLoggedEntriesForExercise.mockResolvedValue([]);

    const result = await useCase.execute('ex-1', 'user-1');

    expect(result).toEqual([]);
  });

  it('propagates NotFoundException from the visibility gate and never queries logged entries', async () => {
    getExerciseByIdExecute.mockRejectedValue(
      new NotFoundException('Exercise "ex-1" not found'),
    );

    await expect(useCase.execute('ex-1', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(findLoggedEntriesForExercise).not.toHaveBeenCalled();
  });
});
