import { Test, TestingModule } from '@nestjs/testing';
import {
  CreateCategoryCommand,
  CreateCategoryUseCase,
} from '../../application/use-cases/create-category.use-case';
import {
  UpdateCategoryCommand,
  UpdateCategoryUseCase,
} from '../../application/use-cases/update-category.use-case';
import {
  DeleteCategoryCommand,
  DeleteCategoryUseCase,
} from '../../application/use-cases/delete-category.use-case';
import { GetAllCategoriesUseCase } from '../../application/use-cases/get-all-categories.use-case';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { CategoryController } from './category.controller';

const user = { id: 'user-1', email: 'test@example.com', name: 'Test User' };

describe('CategoryController', () => {
  let controller: CategoryController;
  let getAllExecute: jest.Mock;
  let createExecute: jest.Mock;
  let updateExecute: jest.Mock;
  let removeExecute: jest.Mock;

  beforeEach(async () => {
    getAllExecute = jest.fn();
    createExecute = jest.fn();
    updateExecute = jest.fn();
    removeExecute = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoryController],
      providers: [
        {
          provide: GetAllCategoriesUseCase,
          useValue: { execute: getAllExecute },
        },
        {
          provide: CreateCategoryUseCase,
          useValue: { execute: createExecute },
        },
        {
          provide: UpdateCategoryUseCase,
          useValue: { execute: updateExecute },
        },
        {
          provide: DeleteCategoryUseCase,
          useValue: { execute: removeExecute },
        },
      ],
    }).compile();

    controller = module.get(CategoryController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('delegates to GetAllCategoriesUseCase and returns { message, data }', async () => {
      const data = [
        {
          id: 'cat-1',
          name: 'Groceries',
          movementTypeId: 'mt-1',
          isActive: true,
          createdAt: new Date('2024-01-01T00:00:00Z'),
        },
      ];
      getAllExecute.mockResolvedValue(data);

      const result = await controller.findAll(user);

      expect(getAllExecute).toHaveBeenCalledWith(user.id);
      expect(result).toEqual({
        message: 'Get all categories successfully',
        data,
      });
    });
  });

  describe('createOne', () => {
    it('delegates to CreateCategoryUseCase with a command built from the dto', async () => {
      const dto: CreateCategoryDto = {
        name: 'Groceries',
        movementTypeId: 'mt-1',
      };
      let receivedCommand: CreateCategoryCommand | undefined;
      createExecute.mockImplementation((command: CreateCategoryCommand) => {
        receivedCommand = command;
        return Promise.resolve({ id: 'cat-1' });
      });

      const result = await controller.createOne(dto, user);

      expect(createExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Groceries',
          movementTypeId: 'mt-1',
          userId: user.id,
        }),
      );
      expect(receivedCommand).toBeInstanceOf(CreateCategoryCommand);
      expect(result).toEqual({
        message: 'The categories was created successfully',
        data: { id: 'cat-1' },
      });
    });
  });

  describe('updateOne', () => {
    it('delegates to UpdateCategoryUseCase with a command built from the id param and dto', async () => {
      const dto: UpdateCategoryDto = { name: 'Supermarket' };
      let receivedCommand: UpdateCategoryCommand | undefined;
      updateExecute.mockImplementation((command: UpdateCategoryCommand) => {
        receivedCommand = command;
        return Promise.resolve({ id: 'cat-1' });
      });

      const result = await controller.updateOne('cat-1', dto, user);

      expect(updateExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'cat-1',
          userId: user.id,
          name: 'Supermarket',
        }),
      );
      expect(receivedCommand).toBeInstanceOf(UpdateCategoryCommand);
      expect(result).toEqual({
        message: 'The categories was updated successfully',
        data: { id: 'cat-1' },
      });
    });
  });

  describe('deleteOne', () => {
    it('delegates to DeleteCategoryUseCase with a command built from the id param', async () => {
      let receivedCommand: DeleteCategoryCommand | undefined;
      removeExecute.mockImplementation((command: DeleteCategoryCommand) => {
        receivedCommand = command;
        return Promise.resolve({ id: 'cat-1' });
      });

      const result = await controller.deleteOne('cat-1', user);

      expect(removeExecute).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'cat-1', userId: user.id }),
      );
      expect(receivedCommand).toBeInstanceOf(DeleteCategoryCommand);
      expect(result).toEqual({
        message: 'The categories was deleted successfully',
        data: { id: 'cat-1' },
      });
    });
  });
});
