import { Test, TestingModule } from '@nestjs/testing';
import {
  CreateMovementTypeCommand,
  CreateMovementTypeUseCase,
} from '../../application/use-cases/create-movement-type.use-case';
import {
  DeleteMovementTypeCommand,
  DeleteMovementTypeUseCase,
} from '../../application/use-cases/delete-movement-type.use-case';
import { GetAllMovementTypesUseCase } from '../../application/use-cases/get-all-movement-types.use-case';
import { CreateMovementTypeDto } from '../dto/create-movement-type.dto';
import { MovementTypeController } from './movement-type.controller';

describe('MovementTypeController', () => {
  let controller: MovementTypeController;
  let getAllExecute: jest.Mock;
  let createExecute: jest.Mock;
  let removeExecute: jest.Mock;

  beforeEach(async () => {
    getAllExecute = jest.fn();
    createExecute = jest.fn();
    removeExecute = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MovementTypeController],
      providers: [
        {
          provide: GetAllMovementTypesUseCase,
          useValue: { execute: getAllExecute },
        },
        {
          provide: CreateMovementTypeUseCase,
          useValue: { execute: createExecute },
        },
        {
          provide: DeleteMovementTypeUseCase,
          useValue: { execute: removeExecute },
        },
      ],
    }).compile();

    controller = module.get(MovementTypeController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('delegates to GetAllMovementTypesUseCase and returns { message, data }', async () => {
      const data = [
        {
          id: 'mt-1',
          name: 'expense',
          isDefault: true,
          createdAt: new Date('2024-01-01T00:00:00Z'),
        },
      ];
      getAllExecute.mockResolvedValue(data);

      const result = await controller.findAll();

      expect(getAllExecute).toHaveBeenCalled();
      expect(result).toEqual({
        message: 'Get all movement-types successfully',
        data,
      });
    });
  });

  describe('createOne', () => {
    it('delegates to CreateMovementTypeUseCase with a command built from the dto', async () => {
      const dto: CreateMovementTypeDto = { name: 'expense' };
      let receivedCommand: CreateMovementTypeCommand | undefined;
      createExecute.mockImplementation((command: CreateMovementTypeCommand) => {
        receivedCommand = command;
        return Promise.resolve({ id: 'mt-1' });
      });

      const result = await controller.createOne(dto);

      expect(createExecute).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'expense' }),
      );
      expect(receivedCommand).toBeInstanceOf(CreateMovementTypeCommand);
      expect(result).toEqual({
        message: 'The movement-types was created successfully',
        data: { id: 'mt-1' },
      });
    });
  });

  describe('deleteOne', () => {
    it('delegates to DeleteMovementTypeUseCase with a command built from the id param', async () => {
      let receivedCommand: DeleteMovementTypeCommand | undefined;
      removeExecute.mockImplementation((command: DeleteMovementTypeCommand) => {
        receivedCommand = command;
        return Promise.resolve({ id: 'mt-1' });
      });

      const result = await controller.deleteOne('mt-1');

      expect(removeExecute).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'mt-1' }),
      );
      expect(receivedCommand).toBeInstanceOf(DeleteMovementTypeCommand);
      expect(result).toEqual({
        message: 'The movement-types was deleted successfully',
        data: { id: 'mt-1' },
      });
    });
  });
});
