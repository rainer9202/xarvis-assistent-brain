import { ExerciseEntity } from '../../domain/entities/exercise.entity';
import type { ExerciseRepositoryPort } from '../../domain/ports/exercise.repository.port';
import { GetExercisesByIdsUseCase } from './get-exercises-by-ids.use-case';

describe('GetExercisesByIdsUseCase', () => {
  let findByIds: jest.Mock;
  let repository: ExerciseRepositoryPort;
  let useCase: GetExercisesByIdsUseCase;

  beforeEach(() => {
    findByIds = jest.fn();
    repository = {
      findAll: jest.fn(),
      findByIds,
      findById: jest.fn(),
      findOwnById: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      countRoutineExercisesByExerciseId: jest.fn(),
      countSessionExercisesByExerciseId: jest.fn(),
    };
    useCase = new GetExercisesByIdsUseCase(repository);
  });

  it('deduplicates ids before querying the repository', async () => {
    findByIds.mockResolvedValue([
      new ExerciseEntity({
        id: 'ex-1',
        userId: null,
        name: 'Push-up',
        createdAt: new Date('2024-01-01T00:00:00Z'),
      }),
    ]);

    await useCase.execute(['ex-1', 'ex-1', 'ex-1'], 'user-1');

    expect(findByIds).toHaveBeenCalledWith(['ex-1'], 'user-1');
  });

  it('marks global rows as isCustom: false and own rows as isCustom: true', async () => {
    findByIds.mockResolvedValue([
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

    const result = await useCase.execute(['global-1', 'own-1'], 'user-1');

    expect(result[0]).toMatchObject({ id: 'global-1', isCustom: false });
    expect(result[1]).toMatchObject({ id: 'own-1', isCustom: true });
    expect(result[0]).not.toHaveProperty('userId');
  });

  it('returns an empty array for an empty id list (the short-circuit lives in the repository)', async () => {
    findByIds.mockResolvedValue([]);

    const result = await useCase.execute([], 'user-1');

    expect(findByIds).toHaveBeenCalledWith([], 'user-1');
    expect(result).toEqual([]);
  });
});
