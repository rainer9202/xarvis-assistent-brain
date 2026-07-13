import { Test, TestingModule } from '@nestjs/testing';
import {
  CreateExerciseCommand,
  CreateExerciseUseCase,
} from '../../application/use-cases/create-exercise.use-case';
import {
  UpdateExerciseCommand,
  UpdateExerciseUseCase,
} from '../../application/use-cases/update-exercise.use-case';
import {
  DeleteExerciseCommand,
  DeleteExerciseUseCase,
} from '../../application/use-cases/delete-exercise.use-case';
import { GetAllExercisesUseCase } from '../../application/use-cases/get-all-exercises.use-case';
import { GetExerciseByIdUseCase } from '../../application/use-cases/get-exercise-by-id.use-case';
import { CreateExerciseDto } from '../dto/create-exercise.dto';
import { UpdateExerciseDto } from '../dto/update-exercise.dto';
import { ExerciseController } from './exercise.controller';

const user = { id: 'user-1', email: 'test@example.com', name: 'Test User' };

describe('ExerciseController', () => {
  let controller: ExerciseController;
  let getAllExecute: jest.Mock;
  let getByIdExecute: jest.Mock;
  let createExecute: jest.Mock;
  let updateExecute: jest.Mock;
  let removeExecute: jest.Mock;

  beforeEach(async () => {
    getAllExecute = jest.fn();
    getByIdExecute = jest.fn();
    createExecute = jest.fn();
    updateExecute = jest.fn();
    removeExecute = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExerciseController],
      providers: [
        {
          provide: GetAllExercisesUseCase,
          useValue: { execute: getAllExecute },
        },
        {
          provide: GetExerciseByIdUseCase,
          useValue: { execute: getByIdExecute },
        },
        {
          provide: CreateExerciseUseCase,
          useValue: { execute: createExecute },
        },
        {
          provide: UpdateExerciseUseCase,
          useValue: { execute: updateExecute },
        },
        {
          provide: DeleteExerciseUseCase,
          useValue: { execute: removeExecute },
        },
      ],
    }).compile();

    controller = module.get(ExerciseController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('delegates to GetAllExercisesUseCase', async () => {
      const data = [{ id: 'ex-1', name: 'Push-up', isCustom: false }];
      getAllExecute.mockResolvedValue(data);

      const result = await controller.findAll(user);

      expect(getAllExecute).toHaveBeenCalledWith(user.id);
      expect(result).toEqual({
        message: 'Get all exercises successfully',
        data,
      });
    });
  });

  describe('findOne', () => {
    it('delegates to GetExerciseByIdUseCase', async () => {
      const data = { id: 'ex-1', name: 'Push-up', isCustom: false };
      getByIdExecute.mockResolvedValue(data);

      const result = await controller.findOne('ex-1', user);

      expect(getByIdExecute).toHaveBeenCalledWith('ex-1', user.id);
      expect(result).toEqual({ message: 'Get exercises successfully', data });
    });
  });

  describe('createOne', () => {
    it('delegates to CreateExerciseUseCase with a command built from the dto', async () => {
      const dto: CreateExerciseDto = { name: 'Custom Curl' };
      let receivedCommand: CreateExerciseCommand | undefined;
      createExecute.mockImplementation((command: CreateExerciseCommand) => {
        receivedCommand = command;
        return Promise.resolve({ id: 'ex-1' });
      });

      const result = await controller.createOne(dto, user);

      expect(createExecute).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Custom Curl', userId: user.id }),
      );
      expect(receivedCommand).toBeInstanceOf(CreateExerciseCommand);
      expect(result).toEqual({
        message: 'The exercises was created successfully',
        data: { id: 'ex-1' },
      });
    });
  });

  describe('updateOne', () => {
    it('delegates to UpdateExerciseUseCase', async () => {
      const dto: UpdateExerciseDto = { name: 'Renamed' };
      let receivedCommand: UpdateExerciseCommand | undefined;
      updateExecute.mockImplementation((command: UpdateExerciseCommand) => {
        receivedCommand = command;
        return Promise.resolve({ id: 'ex-1' });
      });

      const result = await controller.updateOne('ex-1', dto, user);

      expect(updateExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'ex-1',
          userId: user.id,
          name: 'Renamed',
        }),
      );
      expect(receivedCommand).toBeInstanceOf(UpdateExerciseCommand);
      expect(result).toEqual({
        message: 'The exercises was updated successfully',
        data: { id: 'ex-1' },
      });
    });
  });

  describe('deleteOne', () => {
    it('delegates to DeleteExerciseUseCase', async () => {
      let receivedCommand: DeleteExerciseCommand | undefined;
      removeExecute.mockImplementation((command: DeleteExerciseCommand) => {
        receivedCommand = command;
        return Promise.resolve({ id: 'ex-1' });
      });

      const result = await controller.deleteOne('ex-1', user);

      expect(removeExecute).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'ex-1', userId: user.id }),
      );
      expect(receivedCommand).toBeInstanceOf(DeleteExerciseCommand);
      expect(result).toEqual({
        message: 'The exercises was deleted successfully',
        data: { id: 'ex-1' },
      });
    });
  });
});
