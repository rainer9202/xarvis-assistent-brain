import { NotFoundException } from '@domain/exceptions/domain.exception';
import { WorkoutSessionEntity } from '../../domain/entities/workout-session.entity';
import type { WorkoutSessionRepositoryPort } from '../../domain/ports/workout-session.repository.port';
import {
  CreateWorkoutSessionCommand,
  CreateWorkoutSessionUseCase,
} from './create-workout-session.use-case';

describe('CreateWorkoutSessionUseCase', () => {
  let save: jest.Mock;
  let repository: WorkoutSessionRepositoryPort;
  let getRoutineByIdExecute: jest.Mock;
  let useCase: CreateWorkoutSessionUseCase;

  beforeEach(() => {
    save = jest.fn();
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByIdWithExercises: jest.fn(),
      save,
      update: jest.fn(),
      delete: jest.fn(),
    };
    getRoutineByIdExecute = jest.fn();
    useCase = new CreateWorkoutSessionUseCase(repository, {
      execute: getRoutineByIdExecute,
    } as never);
  });

  it('creates a session with finishedAt: null after validating routine ownership', async () => {
    getRoutineByIdExecute.mockResolvedValue({ id: 'routine-1', name: 'Pecho' });
    let savedEntity: WorkoutSessionEntity | undefined;
    save.mockImplementation((entity: WorkoutSessionEntity) => {
      savedEntity = entity;
      return Promise.resolve(
        new WorkoutSessionEntity({ id: 'session-1', ...entity }),
      );
    });

    const date = new Date('2024-01-01T00:00:00Z');
    const result = await useCase.execute(
      new CreateWorkoutSessionCommand('user-1', 'routine-1', date),
    );

    expect(getRoutineByIdExecute).toHaveBeenCalledWith('routine-1', 'user-1');
    expect(savedEntity?.finishedAt).toBeNull();
    expect(result).toEqual({ id: 'session-1' });
  });

  it('propagates NotFoundException when the routine does not exist', async () => {
    getRoutineByIdExecute.mockRejectedValue(
      new NotFoundException('Routine "missing" not found'),
    );

    await expect(
      useCase.execute(
        new CreateWorkoutSessionCommand('user-1', 'missing', new Date()),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(save).not.toHaveBeenCalled();
  });
});
