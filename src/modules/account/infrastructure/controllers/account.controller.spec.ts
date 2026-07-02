import { Test, TestingModule } from '@nestjs/testing';
import {
  CreateAccountCommand,
  CreateAccountUseCase,
} from '../../application/use-cases/create-account.use-case';
import {
  UpdateAccountCommand,
  UpdateAccountUseCase,
} from '../../application/use-cases/update-account.use-case';
import {
  DeleteAccountCommand,
  DeleteAccountUseCase,
} from '../../application/use-cases/delete-account.use-case';
import { GetAllAccountsUseCase } from '../../application/use-cases/get-all-accounts.use-case';
import { CreateAccountDto } from '../dto/create-account.dto';
import { UpdateAccountDto } from '../dto/update-account.dto';
import { AccountController } from './account.controller';

describe('AccountController', () => {
  let controller: AccountController;
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
      controllers: [AccountController],
      providers: [
        { provide: GetAllAccountsUseCase, useValue: { execute: getAllExecute } },
        { provide: CreateAccountUseCase, useValue: { execute: createExecute } },
        { provide: UpdateAccountUseCase, useValue: { execute: updateExecute } },
        { provide: DeleteAccountUseCase, useValue: { execute: removeExecute } },
      ],
    }).compile();

    controller = module.get(AccountController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('delegates to GetAllAccountsUseCase and returns { message, data }', async () => {
      const data = [
        {
          id: 'acc-1',
          name: 'Main Checking',
          type: 'bank',
          isActive: true,
          balanceCents: 5000,
          createdAt: new Date('2024-01-01T00:00:00Z'),
        },
      ];
      getAllExecute.mockResolvedValue(data);

      const result = await controller.findAll();

      expect(getAllExecute).toHaveBeenCalled();
      expect(result).toEqual({
        message: 'Get all accounts successfully',
        data,
      });
    });
  });

  describe('createOne', () => {
    it('delegates to CreateAccountUseCase with a command built from the dto', async () => {
      const dto: CreateAccountDto = { name: 'Main Checking', type: 'bank' };
      let receivedCommand: CreateAccountCommand | undefined;
      createExecute.mockImplementation((command: CreateAccountCommand) => {
        receivedCommand = command;
        return Promise.resolve({
          id: 'acc-1',
          name: 'Main Checking',
          type: 'bank',
          isActive: true,
        });
      });

      const result = await controller.createOne(dto);

      expect(createExecute).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Main Checking', type: 'bank' }),
      );
      expect(receivedCommand).toBeInstanceOf(CreateAccountCommand);
      expect(result).toEqual({
        message: 'The accounts was created successfully',
        data: {
          id: 'acc-1',
          name: 'Main Checking',
          type: 'bank',
          isActive: true,
        },
      });
    });
  });

  describe('updateOne', () => {
    it('delegates to UpdateAccountUseCase with a command built from the id param and dto', async () => {
      const dto: UpdateAccountDto = { name: 'Savings' };
      let receivedCommand: UpdateAccountCommand | undefined;
      updateExecute.mockImplementation((command: UpdateAccountCommand) => {
        receivedCommand = command;
        return Promise.resolve({
          id: 'acc-1',
          name: 'Savings',
          type: 'bank',
          isActive: true,
        });
      });

      const result = await controller.updateOne('acc-1', dto);

      expect(updateExecute).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'acc-1', name: 'Savings' }),
      );
      expect(receivedCommand).toBeInstanceOf(UpdateAccountCommand);
      expect(result).toEqual({
        message: 'The accounts was updated successfully',
        data: {
          id: 'acc-1',
          name: 'Savings',
          type: 'bank',
          isActive: true,
        },
      });
    });
  });

  describe('deleteOne', () => {
    it('delegates to DeleteAccountUseCase with a command built from the id param', async () => {
      let receivedCommand: DeleteAccountCommand | undefined;
      removeExecute.mockImplementation((command: DeleteAccountCommand) => {
        receivedCommand = command;
        return Promise.resolve({ id: 'acc-1', isActive: false });
      });

      const result = await controller.deleteOne('acc-1');

      expect(removeExecute).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'acc-1' }),
      );
      expect(receivedCommand).toBeInstanceOf(DeleteAccountCommand);
      expect(result).toEqual({
        message: 'The accounts was deleted successfully',
        data: { id: 'acc-1', isActive: false },
      });
    });
  });
});
