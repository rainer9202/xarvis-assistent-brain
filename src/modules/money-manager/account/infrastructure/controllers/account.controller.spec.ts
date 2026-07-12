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
import { GetAccountByIdUseCase } from '../../application/use-cases/get-account-by-id.use-case';
import { CreateAccountDto } from '../dto/create-account.dto';
import { UpdateAccountDto } from '../dto/update-account.dto';
import { AccountController } from './account.controller';

const user = { id: 'user-1', email: 'test@example.com', name: 'Test User' };

describe('AccountController', () => {
  let controller: AccountController;
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
      controllers: [AccountController],
      providers: [
        {
          provide: GetAllAccountsUseCase,
          useValue: { execute: getAllExecute },
        },
        {
          provide: GetAccountByIdUseCase,
          useValue: { execute: getByIdExecute },
        },
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
          type: 'AT02',
          isActive: true,
          balanceCents: 5000,
          createdAt: new Date('2024-01-01T00:00:00Z'),
        },
      ];
      getAllExecute.mockResolvedValue(data);

      const result = await controller.findAll(user);

      expect(getAllExecute).toHaveBeenCalledWith(user.id);
      expect(result).toEqual({
        message: 'Get all accounts successfully',
        data,
      });
    });
  });

  describe('findOne', () => {
    it('delegates to GetAccountByIdUseCase and returns { message, data }', async () => {
      const data = {
        id: 'acc-1',
        name: 'Main Checking',
        type: 'AT02',
        isActive: true,
        balanceCents: 5000,
        createdAt: new Date('2024-01-01T00:00:00Z'),
      };
      getByIdExecute.mockResolvedValue(data);

      const result = await controller.findOne('acc-1', user);

      expect(getByIdExecute).toHaveBeenCalledWith('acc-1', user.id);
      expect(result).toEqual({
        message: 'The account was found successfully',
        data,
      });
    });
  });

  describe('createOne', () => {
    it('delegates to CreateAccountUseCase with a command built from the dto', async () => {
      const dto: CreateAccountDto = { name: 'Main Checking', type: 'AT02' };
      let receivedCommand: CreateAccountCommand | undefined;
      createExecute.mockImplementation((command: CreateAccountCommand) => {
        receivedCommand = command;
        return Promise.resolve({ id: 'acc-1' });
      });

      const result = await controller.createOne(dto, user);

      expect(createExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Main Checking',
          type: 'AT02',
          userId: user.id,
        }),
      );
      expect(receivedCommand).toBeInstanceOf(CreateAccountCommand);
      expect(result).toEqual({
        message: 'The accounts was created successfully',
        data: { id: 'acc-1' },
      });
    });

    it('passes dto.creditLimitCents through to the command', async () => {
      const dto: CreateAccountDto = {
        name: 'Credit Card',
        type: 'AT03',
        creditLimitCents: 50000000,
      };
      let receivedCommand: CreateAccountCommand | undefined;
      createExecute.mockImplementation((command: CreateAccountCommand) => {
        receivedCommand = command;
        return Promise.resolve({ id: 'acc-1' });
      });

      await controller.createOne(dto, user);

      expect(receivedCommand?.creditLimitCents).toBe(50000000);
    });
  });

  describe('updateOne', () => {
    it('delegates to UpdateAccountUseCase with a command built from the id param and dto', async () => {
      const dto: UpdateAccountDto = { name: 'Savings' };
      let receivedCommand: UpdateAccountCommand | undefined;
      updateExecute.mockImplementation((command: UpdateAccountCommand) => {
        receivedCommand = command;
        return Promise.resolve({ id: 'acc-1' });
      });

      const result = await controller.updateOne('acc-1', dto, user);

      expect(updateExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'acc-1',
          userId: user.id,
          name: 'Savings',
        }),
      );
      expect(receivedCommand).toBeInstanceOf(UpdateAccountCommand);
      expect(result).toEqual({
        message: 'The accounts was updated successfully',
        data: { id: 'acc-1' },
      });
    });

    it('passes dto.isPrincipal through to the command', async () => {
      const dto: UpdateAccountDto = { isPrincipal: true };
      let receivedCommand: UpdateAccountCommand | undefined;
      updateExecute.mockImplementation((command: UpdateAccountCommand) => {
        receivedCommand = command;
        return Promise.resolve({ id: 'acc-1' });
      });

      await controller.updateOne('acc-1', dto, user);

      expect(updateExecute).toHaveBeenCalledWith(
        expect.objectContaining({ isPrincipal: true }),
      );
      expect(receivedCommand?.isPrincipal).toBe(true);
    });

    it('passes dto.creditLimitCents through to the command', async () => {
      const dto: UpdateAccountDto = { creditLimitCents: null };
      let receivedCommand: UpdateAccountCommand | undefined;
      updateExecute.mockImplementation((command: UpdateAccountCommand) => {
        receivedCommand = command;
        return Promise.resolve({ id: 'acc-1' });
      });

      await controller.updateOne('acc-1', dto, user);

      expect(receivedCommand?.creditLimitCents).toBeNull();
    });
  });

  describe('deleteOne', () => {
    it('delegates to DeleteAccountUseCase with a command built from the id param', async () => {
      let receivedCommand: DeleteAccountCommand | undefined;
      removeExecute.mockImplementation((command: DeleteAccountCommand) => {
        receivedCommand = command;
        return Promise.resolve({ id: 'acc-1' });
      });

      const result = await controller.deleteOne('acc-1', user);

      expect(removeExecute).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'acc-1', userId: user.id }),
      );
      expect(receivedCommand).toBeInstanceOf(DeleteAccountCommand);
      expect(result).toEqual({
        message: 'The accounts was deleted successfully',
        data: { id: 'acc-1' },
      });
    });
  });
});
