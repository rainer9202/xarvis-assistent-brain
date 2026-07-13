import { NotFoundException } from '@domain/exceptions/domain.exception';
import { ExerciseEntity } from '../../domain/entities/exercise.entity';
import type { ExerciseRepositoryPort } from '../../domain/ports/exercise.repository.port';
import { GetExerciseByIdUseCase } from './get-exercise-by-id.use-case';

describe('GetExerciseByIdUseCase', () => {
  let findById: jest.Mock;
  let repository: ExerciseRepositoryPort;
  let useCase: GetExerciseByIdUseCase;

  beforeEach(() => {
    findById = jest.fn();
    repository = {
      findAll: jest.fn(),
      findByIds: jest.fn(),
      findById,
      findOwnById: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      countRoutineExercisesByExerciseId: jest.fn(),
      countSessionExercisesByExerciseId: jest.fn(),
    };
    useCase = new GetExerciseByIdUseCase(repository);
  });

  it('returns a global exercise (read access allows own OR global)', async () => {
    findById.mockResolvedValue(
      new ExerciseEntity({
        id: 'global-1',
        userId: null,
        name: 'Push-up',
        createdAt: new Date('2024-01-01T00:00:00Z'),
      }),
    );

    const result = await useCase.execute('global-1', 'user-1');

    expect(findById).toHaveBeenCalledWith('global-1', 'user-1');
    expect(result).toMatchObject({ id: 'global-1', isCustom: false });
  });

  it('throws NotFoundException when not found', async () => {
    findById.mockResolvedValue(null);

    await expect(useCase.execute('missing', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
