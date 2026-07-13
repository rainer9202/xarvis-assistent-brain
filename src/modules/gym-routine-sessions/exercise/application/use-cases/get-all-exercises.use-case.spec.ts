import { ExerciseEntity } from '../../domain/entities/exercise.entity';
import type { ExerciseRepositoryPort } from '../../domain/ports/exercise.repository.port';
import { GetAllExercisesUseCase } from './get-all-exercises.use-case';

describe('GetAllExercisesUseCase', () => {
  let findAll: jest.Mock;
  let repository: ExerciseRepositoryPort;
  let useCase: GetAllExercisesUseCase;

  beforeEach(() => {
    findAll = jest.fn();
    repository = {
      findAll,
      findByIds: jest.fn(),
      findById: jest.fn(),
      findOwnById: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      countRoutineExercisesByExerciseId: jest.fn(),
      countSessionExercisesByExerciseId: jest.fn(),
    };
    useCase = new GetAllExercisesUseCase(repository);
  });

  it('marks global (userId: null) rows as isCustom: false and own rows as isCustom: true', async () => {
    findAll.mockResolvedValue([
      new ExerciseEntity({
        id: 'global-1',
        userId: null,
        name: 'Push-up',
        createdAt: new Date('2024-01-01T00:00:00Z'),
      }),
      new ExerciseEntity({
        id: 'own-1',
        userId: 'user-1',
        name: 'Custom Curl',
        createdAt: new Date('2024-01-02T00:00:00Z'),
      }),
    ]);

    const result = await useCase.execute('user-1');

    expect(findAll).toHaveBeenCalledWith('user-1');
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: 'global-1', isCustom: false });
    expect(result[1]).toMatchObject({ id: 'own-1', isCustom: true });
    // userId itself must never leak into the response.
    expect(result[0]).not.toHaveProperty('userId');
  });
});
