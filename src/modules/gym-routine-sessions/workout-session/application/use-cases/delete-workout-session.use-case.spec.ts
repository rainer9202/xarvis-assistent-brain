import { NotFoundException } from '@domain/exceptions/domain.exception';
import { WorkoutSessionEntity } from '../../domain/entities/workout-session.entity';
import type { WorkoutSessionRepositoryPort } from '../../domain/ports/workout-session.repository.port';
import {
  DeleteWorkoutSessionCommand,
  DeleteWorkoutSessionUseCase,
} from './delete-workout-session.use-case';

describe('DeleteWorkoutSessionUseCase', () => {
  let findById: jest.Mock;
  let deleteFn: jest.Mock;
  let repository: WorkoutSessionRepositoryPort;
  let useCase: DeleteWorkoutSessionUseCase;

  beforeEach(() => {
    findById = jest.fn();
    deleteFn = jest.fn();
    repository = {
      findAll: jest.fn(),
      findById,
      findByIdWithExercises: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: deleteFn,
    };
    useCase = new DeleteWorkoutSessionUseCase(repository);
  });

  it('deletes without a referential guard (children cascade)', async () => {
    const entity = new WorkoutSessionEntity({
      id: 'session-1',
      userId: 'user-1',
      routineId: 'routine-1',
      date: new Date(),
    });
    findById.mockResolvedValue(entity);

    const result = await useCase.execute(
      new DeleteWorkoutSessionCommand('session-1', 'user-1'),
    );

    expect(deleteFn).toHaveBeenCalledWith(entity);
    expect(result).toEqual({ id: 'session-1' });
  });

  it('throws NotFoundException when not found', async () => {
    findById.mockResolvedValue(null);

    await expect(
      useCase.execute(new DeleteWorkoutSessionCommand('missing', 'user-1')),
    ).rejects.toThrow(NotFoundException);
    expect(deleteFn).not.toHaveBeenCalled();
  });
});
