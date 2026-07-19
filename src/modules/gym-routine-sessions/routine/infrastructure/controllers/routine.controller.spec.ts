import { Test, TestingModule } from '@nestjs/testing';
import {
  CreateRoutineCommand,
  CreateRoutineUseCase,
} from '../../application/use-cases/create-routine.use-case';
import {
  UpdateRoutineCommand,
  UpdateRoutineUseCase,
} from '../../application/use-cases/update-routine.use-case';
import {
  DeleteRoutineCommand,
  DeleteRoutineUseCase,
} from '../../application/use-cases/delete-routine.use-case';
import { GetAllRoutinesUseCase } from '../../application/use-cases/get-all-routines.use-case';
import { GetRoutineByIdUseCase } from '../../application/use-cases/get-routine-by-id.use-case';
import { CreateRoutineDto } from '../dto/create-routine.dto';
import { UpdateRoutineDto } from '../dto/update-routine.dto';
import { GetRoutinesQueryDto } from '../dto/get-routines-query.dto';
import { RoutineController } from './routine.controller';

const user = { id: 'user-1', email: 'test@example.com', name: 'Test User' };

describe('RoutineController', () => {
  let controller: RoutineController;
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
      controllers: [RoutineController],
      providers: [
        {
          provide: GetAllRoutinesUseCase,
          useValue: { execute: getAllExecute },
        },
        {
          provide: GetRoutineByIdUseCase,
          useValue: { execute: getByIdExecute },
        },
        { provide: CreateRoutineUseCase, useValue: { execute: createExecute } },
        { provide: UpdateRoutineUseCase, useValue: { execute: updateExecute } },
        { provide: DeleteRoutineUseCase, useValue: { execute: removeExecute } },
      ],
    }).compile();

    controller = module.get(RoutineController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns items as data with no pagination keys when unpaginated', async () => {
      const items = [
        { id: 'routine-1', name: 'Pecho', isActive: true, exerciseCount: 3 },
      ];
      getAllExecute.mockResolvedValue({ items });

      const query: GetRoutinesQueryDto = {};
      const result = await controller.findAll(query, user);

      expect(getAllExecute).toHaveBeenCalledWith(user.id, undefined, undefined);
      expect(result).toEqual({
        message: 'Get all routines successfully',
        data: items,
      });
      expect(result).not.toHaveProperty('page');
      expect(result).not.toHaveProperty('totalCount');
    });

    it('adds page/limit/totalCount/totalPages/hasMore as siblings of data when paginated', async () => {
      const items = [
        { id: 'routine-1', name: 'Pecho', isActive: true, exerciseCount: 3 },
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

      const query: GetRoutinesQueryDto = { page: 1, limit: 10 };
      const result = await controller.findAll(query, user);

      expect(getAllExecute).toHaveBeenCalledWith(user.id, 1, 10);
      expect(result).toEqual({
        message: 'Get all routines successfully',
        data: items,
        page: 1,
        limit: 10,
        totalCount: 25,
        totalPages: 3,
        hasMore: true,
      });
    });
  });

  describe('findOne', () => {
    it('delegates to GetRoutineByIdUseCase', async () => {
      const data = {
        id: 'routine-1',
        name: 'Pecho',
        isActive: true,
        exercises: [],
      };
      getByIdExecute.mockResolvedValue(data);

      const result = await controller.findOne('routine-1', user);

      expect(getByIdExecute).toHaveBeenCalledWith('routine-1', user.id);
      expect(result).toEqual({ message: 'Get routines successfully', data });
    });
  });

  describe('createOne', () => {
    it('delegates to CreateRoutineUseCase with a command built from the dto', async () => {
      const dto: CreateRoutineDto = {
        name: 'Pecho',
        exercises: [
          {
            exerciseId: 'ex-1',
            targetSets: 4,
            targetReps: 10,
            targetWeightGrams: 20000,
          },
        ],
      };
      let receivedCommand: CreateRoutineCommand | undefined;
      createExecute.mockImplementation((command: CreateRoutineCommand) => {
        receivedCommand = command;
        return Promise.resolve({ id: 'routine-1' });
      });

      const result = await controller.createOne(dto, user);

      expect(createExecute).toHaveBeenCalledWith(
        expect.objectContaining({ userId: user.id, name: 'Pecho' }),
      );
      expect(receivedCommand).toBeInstanceOf(CreateRoutineCommand);
      expect(result).toEqual({
        message: 'The routines was created successfully',
        data: { id: 'routine-1' },
      });
    });
  });

  describe('updateOne', () => {
    it('delegates to UpdateRoutineUseCase', async () => {
      const dto: UpdateRoutineDto = { name: 'Renamed' };
      let receivedCommand: UpdateRoutineCommand | undefined;
      updateExecute.mockImplementation((command: UpdateRoutineCommand) => {
        receivedCommand = command;
        return Promise.resolve({ id: 'routine-1' });
      });

      const result = await controller.updateOne('routine-1', dto, user);

      expect(updateExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'routine-1',
          userId: user.id,
          name: 'Renamed',
        }),
      );
      expect(receivedCommand).toBeInstanceOf(UpdateRoutineCommand);
      expect(result).toEqual({
        message: 'The routines was updated successfully',
        data: { id: 'routine-1' },
      });
    });
  });

  describe('deleteOne', () => {
    it('delegates to DeleteRoutineUseCase', async () => {
      let receivedCommand: DeleteRoutineCommand | undefined;
      removeExecute.mockImplementation((command: DeleteRoutineCommand) => {
        receivedCommand = command;
        return Promise.resolve({ id: 'routine-1' });
      });

      const result = await controller.deleteOne('routine-1', user);

      expect(removeExecute).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'routine-1', userId: user.id }),
      );
      expect(receivedCommand).toBeInstanceOf(DeleteRoutineCommand);
      expect(result).toEqual({
        message: 'The routines was deleted successfully',
        data: { id: 'routine-1' },
      });
    });
  });
});
