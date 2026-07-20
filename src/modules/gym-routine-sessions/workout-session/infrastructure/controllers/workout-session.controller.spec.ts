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
import { GetWorkoutSessionStatsUseCase } from '../../application/use-cases/get-workout-session-stats.use-case';
import { CreateWorkoutSessionDto } from '../dto/create-workout-session.dto';
import { GetWorkoutSessionsQueryDto } from '../dto/get-workout-sessions-query.dto';
import { WorkoutSessionController } from './workout-session.controller';

const user = { id: 'user-1', email: 'test@example.com', name: 'Test User' };

describe('WorkoutSessionController', () => {
  let controller: WorkoutSessionController;
  let getAllExecute: jest.Mock;
  let getByIdExecute: jest.Mock;
  let getStatsExecute: jest.Mock;
  let createExecute: jest.Mock;
  let finishExecute: jest.Mock;
  let removeExecute: jest.Mock;

  beforeEach(async () => {
    getAllExecute = jest.fn();
    getByIdExecute = jest.fn();
    getStatsExecute = jest.fn();
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
          provide: GetWorkoutSessionStatsUseCase,
          useValue: { execute: getStatsExecute },
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
    it('returns items as data with no pagination keys when unpaginated', async () => {
      const items = [
        { id: 'session-1', routineId: 'routine-1', routineName: 'Pecho' },
      ];
      getAllExecute.mockResolvedValue({ items });

      const query: GetWorkoutSessionsQueryDto = {};
      const result = await controller.findAll(query, user);

      expect(getAllExecute).toHaveBeenCalledWith(user.id, undefined, undefined);
      expect(result).toEqual({
        message: 'Get all workout-sessions successfully',
        data: items,
      });
      expect(result).not.toHaveProperty('page');
      expect(result).not.toHaveProperty('totalCount');
    });

    it('adds page/limit/totalCount/totalPages/hasMore as siblings of data when paginated', async () => {
      const items = [
        { id: 'session-1', routineId: 'routine-1', routineName: 'Pecho' },
      ];
      getAllExecute.mockResolvedValue({
        items,
        pagination: {
          page: 1,
          limit: 10,
          totalCount: 25,
          totalPages: 3,
          hasMore: true,
        },
      });

      const query: GetWorkoutSessionsQueryDto = { page: 1, limit: 10 };
      const result = await controller.findAll(query, user);

      expect(getAllExecute).toHaveBeenCalledWith(user.id, 1, 10);
      expect(result).toEqual({
        message: 'Get all workout-sessions successfully',
        data: items,
        page: 1,
        limit: 10,
        totalCount: 25,
        totalPages: 3,
        hasMore: true,
      });
    });
  });

  describe('getStats', () => {
    it('delegates to GetWorkoutSessionStatsUseCase and wraps the result under data', async () => {
      const data = {
        totalCount: 42,
        countThisMonth: 6,
        currentStreak: 3,
        avgDurationMinutes: 54,
      };
      getStatsExecute.mockResolvedValue(data);

      const result = await controller.getStats(user);

      expect(getStatsExecute).toHaveBeenCalledWith(user.id);
      expect(result).toEqual({
        message: 'Get workout session stats successfully',
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
