import { NotFoundException } from '@domain/exceptions/domain.exception';
import { WorkoutSessionEntity } from '../../domain/entities/workout-session.entity';
import { WorkoutSessionExerciseEntity } from '../../domain/entities/workout-session-exercise.entity';
import type { WorkoutSessionRepositoryPort } from '../../domain/ports/workout-session.repository.port';
import { GetWorkoutSessionByIdUseCase } from './get-workout-session-by-id.use-case';

describe('GetWorkoutSessionByIdUseCase', () => {
  let findByIdWithExercises: jest.Mock;
  let repository: WorkoutSessionRepositoryPort;
  let getRoutineByIdExecute: jest.Mock;
  let getExercisesByIdsExecute: jest.Mock;
  let useCase: GetWorkoutSessionByIdUseCase;

  beforeEach(() => {
    findByIdWithExercises = jest.fn();
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByIdWithExercises,
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    getRoutineByIdExecute = jest.fn();
    getExercisesByIdsExecute = jest.fn();
    useCase = new GetWorkoutSessionByIdUseCase(
      repository,
      { execute: getRoutineByIdExecute } as never,
      { execute: getExercisesByIdsExecute } as never,
    );
  });

  it("resolves routineName and per-entry exerciseName scoped to this session's own exercises, without N+1 queries or a full-catalog fetch", async () => {
    findByIdWithExercises.mockResolvedValue({
      session: new WorkoutSessionEntity({
        id: 'session-1',
        userId: 'user-1',
        routineId: 'routine-1',
        date: new Date('2024-01-01T00:00:00Z'),
        finishedAt: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
      }),
      exercises: [
        new WorkoutSessionExerciseEntity({
          id: 'wse-1',
          workoutSessionId: 'session-1',
          exerciseId: 'ex-1',
          actualSets: 4,
          actualReps: 10,
          actualWeightGrams: 18000,
        }),
      ],
    });
    getRoutineByIdExecute.mockResolvedValue({ id: 'routine-1', name: 'Pecho' });
    getExercisesByIdsExecute.mockResolvedValue([
      { id: 'ex-1', name: 'Bench Press', isCustom: false },
    ]);

    const result = await useCase.execute('session-1', 'user-1');

    expect(getExercisesByIdsExecute).toHaveBeenCalledTimes(1);
    expect(getExercisesByIdsExecute).toHaveBeenCalledWith(['ex-1'], 'user-1');
    expect(result.routineName).toBe('Pecho');
    expect(result.exercises).toEqual([
      {
        id: 'wse-1',
        exerciseId: 'ex-1',
        exerciseName: 'Bench Press',
        actualSets: 4,
        actualReps: 10,
        actualWeightGrams: 18000,
      },
    ]);
  });

  it('throws NotFoundException when the session does not exist', async () => {
    findByIdWithExercises.mockResolvedValue(null);

    await expect(useCase.execute('missing', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
