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
      countByUserId: jest.fn(),
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

    expect(findAll).toHaveBeenCalledWith('user-1', undefined, undefined);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ id: 'global-1', isCustom: false });
    expect(result.items[1]).toMatchObject({ id: 'own-1', isCustom: true });
    // userId itself must never leak into the response.
    expect(result.items[0]).not.toHaveProperty('userId');
    expect(result.pagination).toBeUndefined();
  });

  it('does not call countByUserId when neither page nor limit is provided', async () => {
    findAll.mockResolvedValue([]);

    await useCase.execute('user-1');

    expect(repository.countByUserId).not.toHaveBeenCalled();
  });

  it('adds pagination metadata as a sibling of items when page/limit are provided', async () => {
    findAll.mockResolvedValue([
      new ExerciseEntity({
        id: 'ex-1',
        userId: 'user-1',
        name: 'Curl',
        createdAt: new Date('2024-01-01T00:00:00Z'),
      }),
    ]);
    (repository.countByUserId as jest.Mock).mockResolvedValue(25);

    const result = await useCase.execute('user-1', 1, 10);

    expect(findAll).toHaveBeenCalledWith('user-1', 1, 10);
    expect(repository.countByUserId).toHaveBeenCalledWith('user-1');
    expect(result.pagination).toEqual({
      page: 1,
      limit: 10,
      totalCount: 25,
      totalPages: 3,
      hasMore: true,
    });
  });
});
