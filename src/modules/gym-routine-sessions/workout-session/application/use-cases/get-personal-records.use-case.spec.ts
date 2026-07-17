import type { WorkoutSessionExerciseRepositoryPort } from '../../domain/ports/workout-session-exercise.repository.port';
import { GetPersonalRecordsUseCase } from './get-personal-records.use-case';

describe('GetPersonalRecordsUseCase', () => {
  let findPersonalRecords: jest.Mock;
  let repository: WorkoutSessionExerciseRepositoryPort;
  let useCase: GetPersonalRecordsUseCase;

  beforeEach(() => {
    findPersonalRecords = jest.fn();
    repository = {
      findById: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findLoggedEntriesForExercise: jest.fn(),
      findPersonalRecords,
    };
    useCase = new GetPersonalRecordsUseCase(repository);
  });

  it('returns one PersonalRecordEntry per exercise unchanged when the repository returns a single candidate row per exercise', async () => {
    findPersonalRecords.mockResolvedValue([
      {
        exerciseId: 'ex-1',
        exerciseName: 'Bench Press',
        maxWeightGrams: 20000,
        sessionId: 'session-1',
        sessionDate: new Date('2024-01-01T00:00:00Z'),
        routineId: 'routine-1',
        routineName: 'Push Day',
      },
      {
        exerciseId: 'ex-2',
        exerciseName: 'Squat',
        maxWeightGrams: 15000,
        sessionId: 'session-2',
        sessionDate: new Date('2024-02-01T00:00:00Z'),
        routineId: 'routine-2',
        routineName: 'Leg Day',
      },
    ]);

    const result = await useCase.execute('user-1');

    expect(findPersonalRecords).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([
      {
        exerciseId: 'ex-1',
        exerciseName: 'Bench Press',
        maxWeightGrams: 20000,
        sessionId: 'session-1',
        sessionDate: new Date('2024-01-01T00:00:00Z'),
        routineId: 'routine-1',
        routineName: 'Push Day',
      },
      {
        exerciseId: 'ex-2',
        exerciseName: 'Squat',
        maxWeightGrams: 15000,
        sessionId: 'session-2',
        sessionDate: new Date('2024-02-01T00:00:00Z'),
        routineId: 'routine-2',
        routineName: 'Leg Day',
      },
    ]);
  });

  it('keeps only the first-seen row per exerciseId on a tie (repository returns earliest-date row first, per ADR-2 orderBy asc) and drops the later one', async () => {
    findPersonalRecords.mockResolvedValue([
      {
        exerciseId: 'ex-1',
        exerciseName: 'Bench Press',
        maxWeightGrams: 20000,
        sessionId: 'session-earliest',
        sessionDate: new Date('2024-01-01T00:00:00Z'),
        routineId: 'routine-1',
        routineName: 'Push Day',
      },
      {
        exerciseId: 'ex-1',
        exerciseName: 'Bench Press',
        maxWeightGrams: 20000,
        sessionId: 'session-later',
        sessionDate: new Date('2024-06-01T00:00:00Z'),
        routineId: 'routine-2',
        routineName: 'Push Day 2',
      },
    ]);

    const result = await useCase.execute('user-1');

    expect(result).toEqual([
      {
        exerciseId: 'ex-1',
        exerciseName: 'Bench Press',
        maxWeightGrams: 20000,
        sessionId: 'session-earliest',
        sessionDate: new Date('2024-01-01T00:00:00Z'),
        routineId: 'routine-1',
        routineName: 'Push Day',
      },
    ]);
  });

  it('returns [] when the repository returns no candidate rows', async () => {
    findPersonalRecords.mockResolvedValue([]);

    const result = await useCase.execute('user-1');

    expect(result).toEqual([]);
  });
});
