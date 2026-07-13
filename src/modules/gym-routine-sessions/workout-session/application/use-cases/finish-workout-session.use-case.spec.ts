import {
  NotFoundException,
  ValidationException,
} from '@domain/exceptions/domain.exception';
import { WorkoutSessionEntity } from '../../domain/entities/workout-session.entity';
import type { WorkoutSessionRepositoryPort } from '../../domain/ports/workout-session.repository.port';
import {
  FinishWorkoutSessionCommand,
  FinishWorkoutSessionUseCase,
} from './finish-workout-session.use-case';

describe('FinishWorkoutSessionUseCase', () => {
  let findById: jest.Mock;
  let update: jest.Mock;
  let repository: WorkoutSessionRepositoryPort;
  let useCase: FinishWorkoutSessionUseCase;

  beforeEach(() => {
    findById = jest.fn();
    update = jest.fn();
    repository = {
      findAll: jest.fn(),
      findById,
      findByIdWithExercises: jest.fn(),
      save: jest.fn(),
      update,
      delete: jest.fn(),
    };
    useCase = new FinishWorkoutSessionUseCase(repository);
  });

  it('sets finishedAt when not already finished', async () => {
    const entity = new WorkoutSessionEntity({
      id: 'session-1',
      userId: 'user-1',
      routineId: 'routine-1',
      date: new Date('2024-01-01T00:00:00Z'),
      finishedAt: null,
    });
    findById.mockResolvedValue(entity);
    update.mockImplementation((e: WorkoutSessionEntity) => Promise.resolve(e));

    const result = await useCase.execute(
      new FinishWorkoutSessionCommand('session-1', 'user-1'),
    );

    expect(entity.finishedAt).toBeInstanceOf(Date);
    expect(result).toEqual({ id: 'session-1' });
  });

  it('throws ValidationException when already finished', async () => {
    findById.mockResolvedValue(
      new WorkoutSessionEntity({
        id: 'session-1',
        userId: 'user-1',
        routineId: 'routine-1',
        date: new Date('2024-01-01T00:00:00Z'),
        finishedAt: new Date('2024-01-01T01:00:00Z'),
      }),
    );

    await expect(
      useCase.execute(new FinishWorkoutSessionCommand('session-1', 'user-1')),
    ).rejects.toThrow(ValidationException);
    expect(update).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when not found', async () => {
    findById.mockResolvedValue(null);

    await expect(
      useCase.execute(new FinishWorkoutSessionCommand('missing', 'user-1')),
    ).rejects.toThrow(NotFoundException);
  });
});
