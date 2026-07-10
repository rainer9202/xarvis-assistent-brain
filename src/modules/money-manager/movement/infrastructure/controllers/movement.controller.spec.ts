import { Test, TestingModule } from '@nestjs/testing';
import {
  CreateMovementCommand,
  CreateMovementUseCase,
} from '../../application/use-cases/create-movement.use-case';
import {
  UpdateMovementCommand,
  UpdateMovementUseCase,
} from '../../application/use-cases/update-movement.use-case';
import {
  DeleteMovementCommand,
  DeleteMovementUseCase,
} from '../../application/use-cases/delete-movement.use-case';
import { GetAllMovementsUseCase } from '../../application/use-cases/get-all-movements.use-case';
import { GetMovementByIdUseCase } from '../../application/use-cases/get-movement-by-id.use-case';
import { CreateMovementDto } from '../dto/create-movement.dto';
import { UpdateMovementDto } from '../dto/update-movement.dto';
import { MovementController } from './movement.controller';

const user = { id: 'user-1', email: 'test@example.com', name: 'Test User' };

describe('MovementController', () => {
  let controller: MovementController;
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
      controllers: [MovementController],
      providers: [
        {
          provide: GetAllMovementsUseCase,
          useValue: { execute: getAllExecute },
        },
        {
          provide: GetMovementByIdUseCase,
          useValue: { execute: getByIdExecute },
        },
        {
          provide: CreateMovementUseCase,
          useValue: { execute: createExecute },
        },
        {
          provide: UpdateMovementUseCase,
          useValue: { execute: updateExecute },
        },
        {
          provide: DeleteMovementUseCase,
          useValue: { execute: removeExecute },
        },
      ],
    }).compile();

    controller = module.get(MovementController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('delegates to GetAllMovementsUseCase and returns { message, data }', async () => {
      const data = [
        {
          id: 'mov-1',
          amountCents: 1500,
          date: new Date('2024-01-01T00:00:00Z'),
          note: 'Weekly groceries',
          accountId: 'acc-1',
          categoryId: 'cat-1',
          movementType: 'Gasto',
          createdAt: new Date('2024-01-01T00:00:00Z'),
        },
      ];
      getAllExecute.mockResolvedValue(data);

      const result = await controller.findAll({}, user);

      expect(getAllExecute).toHaveBeenCalledWith(user.id, undefined);
      expect(result).toEqual({
        message: 'Get all movements successfully',
        data,
      });
    });

    it('passes accountId through to GetAllMovementsUseCase when provided', async () => {
      getAllExecute.mockResolvedValue([]);

      await controller.findAll({ accountId: 'acc-1' }, user);

      expect(getAllExecute).toHaveBeenCalledWith(user.id, 'acc-1');
    });
  });

  describe('findOne', () => {
    it('delegates to GetMovementByIdUseCase and returns { message, data }', async () => {
      const data = {
        id: 'mov-1',
        amountCents: 1500,
        date: new Date('2024-01-01T00:00:00Z'),
        note: 'Weekly groceries',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        movementType: 'Gasto',
        createdAt: new Date('2024-01-01T00:00:00Z'),
      };
      getByIdExecute.mockResolvedValue(data);

      const result = await controller.findOne('mov-1', user);

      expect(getByIdExecute).toHaveBeenCalledWith('mov-1', user.id);
      expect(result).toEqual({
        message: 'The movement was found successfully',
        data,
      });
    });
  });

  describe('createOne', () => {
    it('delegates to CreateMovementUseCase with a command built from the dto', async () => {
      const dto: CreateMovementDto = {
        amountCents: 1500,
        date: '2024-01-01T00:00:00.000Z',
        note: 'Weekly groceries',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        movementType: 'Gasto',
      };
      let receivedCommand: CreateMovementCommand | undefined;
      createExecute.mockImplementation((command: CreateMovementCommand) => {
        receivedCommand = command;
        return Promise.resolve({ id: 'mov-1' });
      });

      const result = await controller.createOne(dto, user);

      expect(createExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          amountCents: 1500,
          note: 'Weekly groceries',
          accountId: 'acc-1',
          categoryId: 'cat-1',
          movementType: 'Gasto',
          userId: user.id,
        }),
      );
      expect(receivedCommand).toBeInstanceOf(CreateMovementCommand);
      expect(receivedCommand?.date).toEqual(new Date(dto.date));
      expect(result).toEqual({
        message: 'The movements was created successfully',
        data: { id: 'mov-1' },
      });
    });

    it('passes dto.toAccountId through to the CreateMovementCommand', async () => {
      const dto: CreateMovementDto = {
        amountCents: 20000,
        date: '2024-01-01T00:00:00.000Z',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        movementType: 'Transferencia',
        toAccountId: 'acc-2',
      };
      let receivedCommand: CreateMovementCommand | undefined;
      createExecute.mockImplementation((command: CreateMovementCommand) => {
        receivedCommand = command;
        return Promise.resolve({ id: 'mov-1' });
      });

      await controller.createOne(dto, user);

      expect(receivedCommand?.toAccountId).toBe('acc-2');
    });
  });

  describe('updateOne', () => {
    it('delegates to UpdateMovementUseCase with a command built from the id param and dto', async () => {
      const dto: UpdateMovementDto = { amountCents: 2000 };
      let receivedCommand: UpdateMovementCommand | undefined;
      updateExecute.mockImplementation((command: UpdateMovementCommand) => {
        receivedCommand = command;
        return Promise.resolve({ id: 'mov-1' });
      });

      const result = await controller.updateOne('mov-1', dto, user);

      expect(updateExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'mov-1',
          userId: user.id,
          amountCents: 2000,
        }),
      );
      expect(receivedCommand).toBeInstanceOf(UpdateMovementCommand);
      expect(result).toEqual({
        message: 'The movements was updated successfully',
        data: { id: 'mov-1' },
      });
    });

    it('passes dto.toAccountId through to the UpdateMovementCommand', async () => {
      const dto: UpdateMovementDto = { toAccountId: 'acc-2' };
      let receivedCommand: UpdateMovementCommand | undefined;
      updateExecute.mockImplementation((command: UpdateMovementCommand) => {
        receivedCommand = command;
        return Promise.resolve({ id: 'mov-1' });
      });

      await controller.updateOne('mov-1', dto, user);

      expect(receivedCommand?.toAccountId).toBe('acc-2');
    });

    it('converts the dto date string to a Date when provided', async () => {
      const dto: UpdateMovementDto = { date: '2024-02-01T00:00:00.000Z' };
      let receivedCommand: UpdateMovementCommand | undefined;
      updateExecute.mockImplementation((command: UpdateMovementCommand) => {
        receivedCommand = command;
        return Promise.resolve({ id: 'mov-1' });
      });

      await controller.updateOne('mov-1', dto, user);

      expect(receivedCommand?.date).toEqual(new Date(dto.date!));
    });
  });

  describe('deleteOne', () => {
    it('delegates to DeleteMovementUseCase with a command built from the id param', async () => {
      let receivedCommand: DeleteMovementCommand | undefined;
      removeExecute.mockImplementation((command: DeleteMovementCommand) => {
        receivedCommand = command;
        return Promise.resolve({ id: 'mov-1' });
      });

      const result = await controller.deleteOne('mov-1', user);

      expect(removeExecute).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'mov-1', userId: user.id }),
      );
      expect(receivedCommand).toBeInstanceOf(DeleteMovementCommand);
      expect(result).toEqual({
        message: 'The movements was deleted successfully',
        data: { id: 'mov-1' },
      });
    });
  });
});
