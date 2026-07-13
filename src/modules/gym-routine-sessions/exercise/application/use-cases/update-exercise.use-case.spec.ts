import { NotFoundException } from '@domain/exceptions/domain.exception';
import { ExerciseEntity } from '../../domain/entities/exercise.entity';
import type { ExerciseRepositoryPort } from '../../domain/ports/exercise.repository.port';
import {
  UpdateExerciseCommand,
  UpdateExerciseUseCase,
} from './update-exercise.use-case';

describe('UpdateExerciseUseCase', () => {
  let findOwnById: jest.Mock;
  let update: jest.Mock;
  let repository: ExerciseRepositoryPort;
  let useCase: UpdateExerciseUseCase;

  beforeEach(() => {
    findOwnById = jest.fn();
    update = jest.fn();
    repository = {
      findAll: jest.fn(),
      findByIds: jest.fn(),
      findById: jest.fn(),
      findOwnById,
      save: jest.fn(),
      update,
      delete: jest.fn(),
      countRoutineExercisesByExerciseId: jest.fn(),
      countSessionExercisesByExerciseId: jest.fn(),
    };
    useCase = new UpdateExerciseUseCase(repository);
  });

  it('updates an owned exercise', async () => {
    const entity = new ExerciseEntity({
      id: 'ex-1',
      userId: 'user-1',
      name: 'Old name',
    });
    findOwnById.mockResolvedValue(entity);
    update.mockImplementation((e: ExerciseEntity) => Promise.resolve(e));

    const result = await useCase.execute(
      new UpdateExerciseCommand('ex-1', 'user-1', 'New name'),
    );

    expect(findOwnById).toHaveBeenCalledWith('ex-1', 'user-1');
    expect(entity.name).toBe('New name');
    expect(result).toEqual({ id: 'ex-1' });
  });

  it('throws NotFoundException for a global (userId: null) exercise — write attempts must not distinguish global from nonexistent', async () => {
    findOwnById.mockResolvedValue(null);

    await expect(
      useCase.execute(new UpdateExerciseCommand('global-ex', 'user-1', 'Hack')),
    ).rejects.toThrow(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });

  it("throws NotFoundException for another user's exercise", async () => {
    findOwnById.mockResolvedValue(null);

    await expect(
      useCase.execute(
        new UpdateExerciseCommand('other-ex', 'user-2', 'Hijacked'),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });
});
