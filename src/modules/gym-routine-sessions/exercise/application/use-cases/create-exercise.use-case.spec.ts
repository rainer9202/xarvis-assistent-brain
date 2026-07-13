import { ExerciseEntity } from '../../domain/entities/exercise.entity';
import type { ExerciseRepositoryPort } from '../../domain/ports/exercise.repository.port';
import {
  CreateExerciseCommand,
  CreateExerciseUseCase,
} from './create-exercise.use-case';

describe('CreateExerciseUseCase', () => {
  let save: jest.Mock;
  let repository: ExerciseRepositoryPort;
  let useCase: CreateExerciseUseCase;

  beforeEach(() => {
    save = jest.fn();
    repository = {
      findAll: jest.fn(),
      findByIds: jest.fn(),
      findById: jest.fn(),
      findOwnById: jest.fn(),
      save,
      update: jest.fn(),
      delete: jest.fn(),
      countRoutineExercisesByExerciseId: jest.fn(),
      countSessionExercisesByExerciseId: jest.fn(),
    };
    useCase = new CreateExerciseUseCase(repository);
  });

  it('creates an exercise scoped to the command userId (never null)', async () => {
    let savedEntity: ExerciseEntity | undefined;
    save.mockImplementation((entity: ExerciseEntity) => {
      savedEntity = entity;
      return Promise.resolve(
        new ExerciseEntity({
          id: 'ex-1',
          userId: entity.userId,
          name: entity.name,
        }),
      );
    });

    const result = await useCase.execute(
      new CreateExerciseCommand('user-1', 'Custom Curl', 'upper arms'),
    );

    expect(save).toHaveBeenCalledWith(expect.any(ExerciseEntity));
    expect(savedEntity?.userId).toBe('user-1');
    expect(savedEntity?.name).toBe('Custom Curl');
    expect(result).toEqual({ id: 'ex-1' });
  });
});
