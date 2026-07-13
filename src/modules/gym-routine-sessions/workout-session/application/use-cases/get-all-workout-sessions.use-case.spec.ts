import { WorkoutSessionEntity } from '../../domain/entities/workout-session.entity';
import type { WorkoutSessionRepositoryPort } from '../../domain/ports/workout-session.repository.port';
import { GetAllWorkoutSessionsUseCase } from './get-all-workout-sessions.use-case';

describe('GetAllWorkoutSessionsUseCase', () => {
  let findAll: jest.Mock;
  let repository: WorkoutSessionRepositoryPort;
  let getAllRoutinesExecute: jest.Mock;
  let useCase: GetAllWorkoutSessionsUseCase;

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
    findAll.mockResolvedValue([
      new WorkoutSessionEntity({
        id: 'session-1',
        userId: 'user-1',
        routineId: 'routine-1',
        date: new Date('2024-01-01T00:00:00Z'),
        finishedAt: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
      }),
    ]);
    getAllRoutinesExecute.mockResolvedValue([
      { id: 'routine-1', name: 'Pecho', isActive: true, exerciseCount: 3 },
    ]);

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
      },
    ]);
  });
});
