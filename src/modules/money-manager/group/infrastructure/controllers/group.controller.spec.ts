import { Test, TestingModule } from '@nestjs/testing';
import {
  CreateGroupCommand,
  CreateGroupUseCase,
} from '../../application/use-cases/create-group.use-case';
import {
  UpdateGroupCommand,
  UpdateGroupUseCase,
} from '../../application/use-cases/update-group.use-case';
import {
  DeleteGroupCommand,
  DeleteGroupUseCase,
} from '../../application/use-cases/delete-group.use-case';
import { GetAllGroupsUseCase } from '../../application/use-cases/get-all-groups.use-case';
import { CreateGroupDto } from '../dto/create-group.dto';
import { UpdateGroupDto } from '../dto/update-group.dto';
import { GroupController } from './group.controller';

const user = { id: 'user-1', email: 'test@example.com', name: 'Test User' };

describe('GroupController', () => {
  let controller: GroupController;
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
      controllers: [GroupController],
      providers: [
        { provide: GetAllGroupsUseCase, useValue: { execute: getAllExecute } },
        { provide: CreateGroupUseCase, useValue: { execute: createExecute } },
        { provide: UpdateGroupUseCase, useValue: { execute: updateExecute } },
        { provide: DeleteGroupUseCase, useValue: { execute: removeExecute } },
      ],
    }).compile();

    controller = module.get(GroupController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('delegates to GetAllGroupsUseCase and returns { message, data }', async () => {
      const data = [
        {
          id: 'grp-1',
          name: 'Fixed Expenses',
          isActive: true,
          createdAt: new Date('2024-01-01T00:00:00Z'),
        },
      ];
      getAllExecute.mockResolvedValue(data);

      const result = await controller.findAll(user);

      expect(getAllExecute).toHaveBeenCalledWith(user.id);
      expect(result).toEqual({ message: 'Get all groups successfully', data });
    });
  });

  describe('createOne', () => {
    it('delegates to CreateGroupUseCase with a command built from the dto', async () => {
      const dto: CreateGroupDto = { name: 'Fixed Expenses' };
      let receivedCommand: CreateGroupCommand | undefined;
      createExecute.mockImplementation((command: CreateGroupCommand) => {
        receivedCommand = command;
        return Promise.resolve({ id: 'grp-1' });
      });

      const result = await controller.createOne(dto, user);

      expect(createExecute).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Fixed Expenses', userId: user.id }),
      );
      expect(receivedCommand).toBeInstanceOf(CreateGroupCommand);
      expect(result).toEqual({
        message: 'The groups was created successfully',
        data: { id: 'grp-1' },
      });
    });

    it('forwards budgetCents from the dto to the command', async () => {
      const dto: CreateGroupDto = {
        name: 'Fixed Expenses',
        budgetCents: 5000000,
      };
      let receivedCommand: CreateGroupCommand | undefined;
      createExecute.mockImplementation((command: CreateGroupCommand) => {
        receivedCommand = command;
        return Promise.resolve({ id: 'grp-1' });
      });

      await controller.createOne(dto, user);

      expect(receivedCommand?.budgetCents).toBe(5000000);
    });
  });

  describe('updateOne', () => {
    it('delegates to UpdateGroupUseCase with a command built from the id param and dto', async () => {
      const dto: UpdateGroupDto = { name: 'Renamed' };
      let receivedCommand: UpdateGroupCommand | undefined;
      updateExecute.mockImplementation((command: UpdateGroupCommand) => {
        receivedCommand = command;
        return Promise.resolve({ id: 'grp-1' });
      });

      const result = await controller.updateOne('grp-1', dto, user);

      expect(updateExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'grp-1',
          userId: user.id,
          name: 'Renamed',
        }),
      );
      expect(receivedCommand).toBeInstanceOf(UpdateGroupCommand);
      expect(result).toEqual({
        message: 'The groups was updated successfully',
        data: { id: 'grp-1' },
      });
    });

    it('forwards budgetCents (including explicit null) from the dto to the command', async () => {
      const dto: UpdateGroupDto = { budgetCents: null };
      let receivedCommand: UpdateGroupCommand | undefined;
      updateExecute.mockImplementation((command: UpdateGroupCommand) => {
        receivedCommand = command;
        return Promise.resolve({ id: 'grp-1' });
      });

      await controller.updateOne('grp-1', dto, user);

      expect(receivedCommand?.budgetCents).toBeNull();
    });
  });

  describe('deleteOne', () => {
    it('delegates to DeleteGroupUseCase with a command built from the id param', async () => {
      let receivedCommand: DeleteGroupCommand | undefined;
      removeExecute.mockImplementation((command: DeleteGroupCommand) => {
        receivedCommand = command;
        return Promise.resolve({ id: 'grp-1' });
      });

      const result = await controller.deleteOne('grp-1', user);

      expect(removeExecute).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'grp-1', userId: user.id }),
      );
      expect(receivedCommand).toBeInstanceOf(DeleteGroupCommand);
      expect(result).toEqual({
        message: 'The groups was deleted successfully',
        data: { id: 'grp-1' },
      });
    });
  });
});
