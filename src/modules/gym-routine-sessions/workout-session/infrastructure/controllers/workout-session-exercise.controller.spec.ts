import { Test, TestingModule } from '@nestjs/testing';
import {
  CreateWorkoutSessionExerciseCommand,
  CreateWorkoutSessionExerciseUseCase,
} from '../../application/use-cases/create-workout-session-exercise.use-case';
import {
  UpdateWorkoutSessionExerciseCommand,
  UpdateWorkoutSessionExerciseUseCase,
} from '../../application/use-cases/update-workout-session-exercise.use-case';
import {
  DeleteWorkoutSessionExerciseCommand,
  DeleteWorkoutSessionExerciseUseCase,
} from '../../application/use-cases/delete-workout-session-exercise.use-case';
import { CreateWorkoutSessionExerciseDto } from '../dto/create-workout-session-exercise.dto';
import { UpdateWorkoutSessionExerciseDto } from '../dto/update-workout-session-exercise.dto';
import { WorkoutSessionExerciseController } from './workout-session-exercise.controller';

const user = { id: 'user-1', email: 'test@example.com', name: 'Test User' };

describe('WorkoutSessionExerciseController', () => {
  let controller: WorkoutSessionExerciseController;
  let createExecute: jest.Mock;
  let updateExecute: jest.Mock;
  let removeExecute: jest.Mock;

  beforeEach(async () => {
    createExecute = jest.fn();
    updateExecute = jest.fn();
    removeExecute = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkoutSessionExerciseController],
      providers: [
        {
          provide: CreateWorkoutSessionExerciseUseCase,
          useValue: { execute: createExecute },
        },
        {
          provide: UpdateWorkoutSessionExerciseUseCase,
          useValue: { execute: updateExecute },
        },
        {
          provide: DeleteWorkoutSessionExerciseUseCase,
          useValue: { execute: removeExecute },
        },
      ],
    }).compile();

    controller = module.get(WorkoutSessionExerciseController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createOne', () => {
    it('delegates to CreateWorkoutSessionExerciseUseCase with a command built from the dto', async () => {
      const dto: CreateWorkoutSessionExerciseDto = {
        workoutSessionId: 'session-1',
        exerciseId: 'ex-1',
        actualSets: 3,
        actualReps: 12,
        actualWeightGrams: 18000,
      };
      let receivedCommand: CreateWorkoutSessionExerciseCommand | undefined;
      createExecute.mockImplementation(
        (command: CreateWorkoutSessionExerciseCommand) => {
          receivedCommand = command;
          return Promise.resolve({ id: 'wse-1' });
        },
      );

      const result = await controller.createOne(dto, user);

      expect(createExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          workoutSessionId: 'session-1',
          userId: user.id,
          exerciseId: 'ex-1',
        }),
      );
      expect(receivedCommand).toBeInstanceOf(
        CreateWorkoutSessionExerciseCommand,
      );
      expect(result).toEqual({
        message: 'The workout-session-exercises was created successfully',
        data: { id: 'wse-1' },
      });
    });
  });

  describe('updateOne', () => {
    it('delegates to UpdateWorkoutSessionExerciseUseCase', async () => {
      const dto: UpdateWorkoutSessionExerciseDto = { actualSets: 4 };
      let receivedCommand: UpdateWorkoutSessionExerciseCommand | undefined;
      updateExecute.mockImplementation(
        (command: UpdateWorkoutSessionExerciseCommand) => {
          receivedCommand = command;
          return Promise.resolve({ id: 'wse-1' });
        },
      );

      const result = await controller.updateOne('wse-1', dto, user);

      expect(updateExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'wse-1',
          userId: user.id,
          actualSets: 4,
        }),
      );
      expect(receivedCommand).toBeInstanceOf(
        UpdateWorkoutSessionExerciseCommand,
      );
      expect(result).toEqual({
        message: 'The workout-session-exercises was updated successfully',
        data: { id: 'wse-1' },
      });
    });
  });

  describe('deleteOne', () => {
    it('delegates to DeleteWorkoutSessionExerciseUseCase', async () => {
      let receivedCommand: DeleteWorkoutSessionExerciseCommand | undefined;
      removeExecute.mockImplementation(
        (command: DeleteWorkoutSessionExerciseCommand) => {
          receivedCommand = command;
          return Promise.resolve({ id: 'wse-1' });
        },
      );

      const result = await controller.deleteOne('wse-1', user);

      expect(removeExecute).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'wse-1', userId: user.id }),
      );
      expect(receivedCommand).toBeInstanceOf(
        DeleteWorkoutSessionExerciseCommand,
      );
      expect(result).toEqual({
        message: 'The workout-session-exercises was deleted successfully',
        data: { id: 'wse-1' },
      });
    });
  });
});
