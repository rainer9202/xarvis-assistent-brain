import { NotFoundException } from '@domain/exceptions/domain.exception';
import { RoutineEntity } from '../../domain/entities/routine.entity';
import { RoutineExerciseEntity } from '../../domain/entities/routine-exercise.entity';
import type { RoutineRepositoryPort } from '../../domain/ports/routine.repository.port';
import { GetRoutineByIdUseCase } from './get-routine-by-id.use-case';

describe('GetRoutineByIdUseCase', () => {
  let findByIdWithExercises: jest.Mock;
  let repository: RoutineRepositoryPort;
  let getExercisesByIdsExecute: jest.Mock;
  let useCase: GetRoutineByIdUseCase;

  beforeEach(() => {
    findByIdWithExercises = jest.fn();
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByIdWithExercises,
      findByName: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      countSessionsByRoutineId: jest.fn(),
    };
    getExercisesByIdsExecute = jest.fn();
    useCase = new GetRoutineByIdUseCase(repository, {
      execute: getExercisesByIdsExecute,
    } as never);
  });

  it('resolves exercise names via a single batched GetExercisesByIdsUseCase call scoped to this routine (no N+1, no full-catalog fetch)', async () => {
    findByIdWithExercises.mockResolvedValue({
      routine: new RoutineEntity({
        id: 'routine-1',
        name: 'Pecho',
        userId: 'user-1',
        isActive: true,
        createdAt: new Date('2024-01-01T00:00:00Z'),
      }),
      exercises: [
        new RoutineExerciseEntity({
          id: 're-1',
          routineId: 'routine-1',
          exerciseId: 'ex-1',
          order: 0,
          targetSets: 4,
          targetReps: 10,
          targetWeightGrams: 20000,
        }),
      ],
    });
    getExercisesByIdsExecute.mockResolvedValue([
      { id: 'ex-1', name: 'Bench Press', isCustom: false },
    ]);

    const result = await useCase.execute('routine-1', 'user-1');

    expect(getExercisesByIdsExecute).toHaveBeenCalledTimes(1);
    expect(getExercisesByIdsExecute).toHaveBeenCalledWith(['ex-1'], 'user-1');
    expect(result.exercises).toEqual([
      {
        exerciseId: 'ex-1',
        exerciseName: 'Bench Press',
        order: 0,
        targetSets: 4,
        targetReps: 10,
        targetWeightGrams: 20000,
      },
    ]);
  });

  it('throws NotFoundException when the routine does not exist', async () => {
    findByIdWithExercises.mockResolvedValue(null);

    await expect(useCase.execute('missing', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
