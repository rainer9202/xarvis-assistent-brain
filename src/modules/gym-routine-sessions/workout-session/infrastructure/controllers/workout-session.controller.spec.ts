import { Test, TestingModule } from '@nestjs/testing';
import {
  CreateWorkoutSessionCommand,
  CreateWorkoutSessionUseCase,
} from '../../application/use-cases/create-workout-session.use-case';
import {
  FinishWorkoutSessionCommand,
  FinishWorkoutSessionUseCase,
} from '../../application/use-cases/finish-workout-session.use-case';
import {
  DeleteWorkoutSessionCommand,
  DeleteWorkoutSessionUseCase,
} from '../../application/use-cases/delete-workout-session.use-case';
import { GetAllWorkoutSessionsUseCase } from '../../application/use-cases/get-all-workout-sessions.use-case';
import { GetWorkoutSessionByIdUseCase } from '../../application/use-cases/get-workout-session-by-id.use-case';
import { CreateWorkoutSessionDto } from '../dto/create-workout-session.dto';
import { WorkoutSessionController } from './workout-session.controller';

const user = { id: 'user-1', email: 'test@example.com', name: 'Test User' };

describe('WorkoutSessionController', () => {
  let controller: WorkoutSessionController;
  let getAllExecute: jest.Mock;
  let getByIdExecute: jest.Mock;
  let createExecute: jest.Mock;
  let finishExecute: jest.Mock;
  let removeExecute: jest.Mock;

  beforeEach(async () => {
    getAllExecute = jest.fn();
    getByIdExecute = jest.fn();
    createExecute = jest.fn();
    finishExecute = jest.fn();
    removeExecute = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkoutSessionController],
      providers: [
        {
          provide: GetAllWorkoutSessionsUseCase,
          useValue: { execute: getAllExecute },
        },
        {
          provide: GetWorkoutSessionByIdUseCase,
          useValue: { execute: getByIdExecute },
        },
        {
          provide: CreateWorkoutSessionUseCase,
          useValue: { execute: createExecute },
        },
        {
          provide: FinishWorkoutSessionUseCase,
          useValue: { execute: finishExecute },
        },
        {
          provide: DeleteWorkoutSessionUseCase,
          useValue: { execute: removeExecute },
        },
      ],
    }).compile();

    controller = module.get(WorkoutSessionController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('delegates to GetAllWorkoutSessionsUseCase', async () => {
      const data = [
        { id: 'session-1', routineId: 'routine-1', routineName: 'Pecho' },
      ];
      getAllExecute.mockResolvedValue(data);

      const result = await controller.findAll(user);

      expect(getAllExecute).toHaveBeenCalledWith(user.id);
      expect(result).toEqual({
        message: 'Get all workout-sessions successfully',
        data,
      });
    });
  });

  describe('findOne', () => {
    it('delegates to GetWorkoutSessionByIdUseCase', async () => {
      const data = { id: 'session-1', routineId: 'routine-1', exercises: [] };
      getByIdExecute.mockResolvedValue(data);

      const result = await controller.findOne('session-1', user);

      expect(getByIdExecute).toHaveBeenCalledWith('session-1', user.id);
      expect(result).toEqual({
        message: 'Get workout-sessions successfully',
        data,
      });
    });
  });

  describe('createOne', () => {
    it('parses the ISO date string and delegates to CreateWorkoutSessionUseCase', async () => {
      const dto: CreateWorkoutSessionDto = {
        routineId: 'routine-1',
        date: '2024-01-01T10:00:00.000Z',
      };
      let receivedCommand: CreateWorkoutSessionCommand | undefined;
      createExecute.mockImplementation(
        (command: CreateWorkoutSessionCommand) => {
          receivedCommand = command;
          return Promise.resolve({ id: 'session-1' });
        },
      );

      const result = await controller.createOne(dto, user);

      expect(createExecute).toHaveBeenCalledWith(
        expect.objectContaining({ userId: user.id, routineId: 'routine-1' }),
      );
      expect(receivedCommand?.date).toBeInstanceOf(Date);
      expect(result).toEqual({
        message: 'The workout-sessions was created successfully',
        data: { id: 'session-1' },
      });
    });
  });

  describe('finishOne', () => {
    it('delegates to FinishWorkoutSessionUseCase', async () => {
      let receivedCommand: FinishWorkoutSessionCommand | undefined;
      finishExecute.mockImplementation(
        (command: FinishWorkoutSessionCommand) => {
          receivedCommand = command;
          return Promise.resolve({ id: 'session-1' });
        },
      );

      const result = await controller.finishOne('session-1', user);

      expect(finishExecute).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'session-1', userId: user.id }),
      );
      expect(receivedCommand).toBeInstanceOf(FinishWorkoutSessionCommand);
      expect(result).toEqual({
        message: 'The workout-sessions was finished successfully',
        data: { id: 'session-1' },
      });
    });
  });

  describe('deleteOne', () => {
    it('delegates to DeleteWorkoutSessionUseCase', async () => {
      let receivedCommand: DeleteWorkoutSessionCommand | undefined;
      removeExecute.mockImplementation(
        (command: DeleteWorkoutSessionCommand) => {
          receivedCommand = command;
          return Promise.resolve({ id: 'session-1' });
        },
      );

      const result = await controller.deleteOne('session-1', user);

      expect(removeExecute).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'session-1', userId: user.id }),
      );
      expect(receivedCommand).toBeInstanceOf(DeleteWorkoutSessionCommand);
      expect(result).toEqual({
        message: 'The workout-sessions was deleted successfully',
        data: { id: 'session-1' },
      });
    });
  });
});
