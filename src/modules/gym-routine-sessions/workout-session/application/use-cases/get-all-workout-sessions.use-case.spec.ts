import { WorkoutSessionEntity } from '../../domain/entities/workout-session.entity';
import type { WorkoutSessionRepositoryPort } from '../../domain/ports/workout-session.repository.port';
import { GetAllWorkoutSessionsUseCase } from './get-all-workout-sessions.use-case';

describe('GetAllWorkoutSessionsUseCase', () => {
  let findAll: jest.Mock;
  let repository: WorkoutSessionRepositoryPort;
  let getAllRoutinesExecute: jest.Mock;
  let useCase: GetAllWorkoutSessionsUseCase;

  const session = (
    overrides: Partial<{ id: string; routineId: string }> = {},
  ) =>
    new WorkoutSessionEntity({
      id: overrides.id ?? 'session-1',
      userId: 'user-1',
      routineId: overrides.routineId ?? 'routine-1',
      date: new Date('2024-01-01T00:00:00Z'),
      finishedAt: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
    });

  beforeEach(() => {
    findAll = jest.fn();
    repository = {
      findAll,
      findById: jest.fn(),
      findByIdWithExercises: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    getAllRoutinesExecute = jest.fn();
    useCase = new GetAllWorkoutSessionsUseCase(repository, {
      execute: getAllRoutinesExecute,
    } as never);
  });

  it('resolves routineName via a single batched GetAllRoutinesUseCase call (no N+1)', async () => {
    findAll.mockResolvedValue([{ session: session(), loggedExerciseCount: 0 }]);
    getAllRoutinesExecute.mockResolvedValue({
      items: [
        { id: 'routine-1', name: 'Pecho', isActive: true, exerciseCount: 3 },
      ],
    });

    const result = await useCase.execute('user-1');

    expect(getAllRoutinesExecute).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      {
        id: 'session-1',
        routineId: 'routine-1',
        routineName: 'Pecho',
        date: new Date('2024-01-01T00:00:00Z'),
        finishedAt: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        loggedExerciseCount: 0,
        totalExerciseCount: 3,
      },
    ]);
  });

  it('maps partially-logged counts: logged 2, routine currently has 4 (spec scenario 1)', async () => {
    findAll.mockResolvedValue([{ session: session(), loggedExerciseCount: 2 }]);
    getAllRoutinesExecute.mockResolvedValue({
      items: [
        { id: 'routine-1', name: 'Pecho', isActive: true, exerciseCount: 4 },
      ],
    });

    const result = await useCase.execute('user-1');

    expect(result[0]).toMatchObject({
      loggedExerciseCount: 2,
      totalExerciseCount: 4,
    });
  });

  it('maps none-logged counts: logged 0, routine currently has 5 (spec scenario 2)', async () => {
    findAll.mockResolvedValue([{ session: session(), loggedExerciseCount: 0 }]);
    getAllRoutinesExecute.mockResolvedValue({
      items: [
        { id: 'routine-1', name: 'Pecho', isActive: true, exerciseCount: 5 },
      ],
    });

    const result = await useCase.execute('user-1');

    expect(result[0]).toMatchObject({
      loggedExerciseCount: 0,
      totalExerciseCount: 5,
    });
  });

  it('returns loggedExerciseCount as-is when it exceeds the routine current count, no clamping, no error (spec scenario 3 / ADR-2)', async () => {
    findAll.mockResolvedValue([{ session: session(), loggedExerciseCount: 6 }]);
    getAllRoutinesExecute.mockResolvedValue({
      items: [
        { id: 'routine-1', name: 'Pecho', isActive: true, exerciseCount: 3 },
      ],
    });

    const result = await useCase.execute('user-1');

    expect(result[0]).toMatchObject({
      loggedExerciseCount: 6,
      totalExerciseCount: 3,
    });
  });

  it('falls back to totalExerciseCount: 0 when the routine is absent from the routines Map', async () => {
    findAll.mockResolvedValue([
      {
        session: session({ routineId: 'missing-routine' }),
        loggedExerciseCount: 3,
      },
    ]);
    getAllRoutinesExecute.mockResolvedValue({
      items: [
        { id: 'routine-1', name: 'Pecho', isActive: true, exerciseCount: 4 },
      ],
    });

    const result = await useCase.execute('user-1');

    expect(result[0]).toMatchObject({
      loggedExerciseCount: 3,
      totalExerciseCount: 0,
    });
  });

  it('keeps all pre-existing fields mapped unchanged (id, routineId, routineName, date, finishedAt, createdAt)', async () => {
    findAll.mockResolvedValue([{ session: session(), loggedExerciseCount: 1 }]);
    getAllRoutinesExecute.mockResolvedValue({
      items: [
        { id: 'routine-1', name: 'Pecho', isActive: true, exerciseCount: 2 },
      ],
    });

    const result = await useCase.execute('user-1');

    expect(result[0]).toMatchObject({
      id: 'session-1',
      routineId: 'routine-1',
      routineName: 'Pecho',
      date: new Date('2024-01-01T00:00:00Z'),
      finishedAt: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
    });
  });
});
