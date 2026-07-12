import { ValidationException } from '@domain/exceptions/domain.exception';
import { AccountEntity } from '../../domain/entities/account.entity';
import type { AccountRepositoryPort } from '../../domain/ports/account.repository.port';
import {
  CreateAccountCommand,
  CreateAccountUseCase,
} from './create-account.use-case';

describe('CreateAccountUseCase', () => {
  let save: jest.Mock;
  let countByUserId: jest.Mock;
  let repository: AccountRepositoryPort;
  let useCase: CreateAccountUseCase;

  beforeEach(() => {
    save = jest.fn();
    countByUserId = jest.fn();
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      save,
      update: jest.fn(),
      countMovementsByAccountId: jest.fn(),
      findAllWithBalance: jest.fn(),
      findByIdWithBalance: jest.fn(),
      countByUserId,
      setPrincipal: jest.fn(),
    };
    useCase = new CreateAccountUseCase(repository);
  });

  it('creates an account defaulting isActive to true', async () => {
    countByUserId.mockResolvedValue(1);
    let savedEntity: AccountEntity | undefined;
    save.mockImplementation((entity: AccountEntity) => {
      savedEntity = entity;
      return Promise.resolve(
        new AccountEntity({
          id: 'acc-1',
          name: entity.name,
          type: entity.type,
          isActive: entity.isActive,
          isPrincipal: entity.isPrincipal,
        }),
      );
    });

    const result = await useCase.execute(
      new CreateAccountCommand('Main Checking', 'AT02', 'user-1'),
    );

    expect(save).toHaveBeenCalledWith(expect.any(AccountEntity));
    expect(savedEntity?.isActive).toBe(true);
    expect(result).toEqual({ id: 'acc-1' });
  });

  it('makes the first account for a user principal', async () => {
    countByUserId.mockResolvedValue(0);
    let savedEntity: AccountEntity | undefined;
    save.mockImplementation((entity: AccountEntity) => {
      savedEntity = entity;
      return Promise.resolve(entity);
    });

    await useCase.execute(
      new CreateAccountCommand('Main Checking', 'AT02', 'user-1'),
    );

    expect(countByUserId).toHaveBeenCalledWith('user-1');
    expect(savedEntity?.isPrincipal).toBe(true);
  });

  it('defaults isPrincipal to false for a second (or later) account', async () => {
    countByUserId.mockResolvedValue(1);
    let savedEntity: AccountEntity | undefined;
    save.mockImplementation((entity: AccountEntity) => {
      savedEntity = entity;
      return Promise.resolve(entity);
    });

    await useCase.execute(
      new CreateAccountCommand('Savings', 'AT02', 'user-1'),
    );

    expect(savedEntity?.isPrincipal).toBe(false);
  });

  it('throws ValidationException when type is not AT01/AT02/AT03', async () => {
    countByUserId.mockResolvedValue(0);

    await expect(
      useCase.execute(new CreateAccountCommand('Wallet', 'crypto', 'user-1')),
    ).rejects.toThrow(ValidationException);
    expect(save).not.toHaveBeenCalled();
  });

  it('throws ValidationException when type is an unknown code like "AT99"', async () => {
    countByUserId.mockResolvedValue(0);

    await expect(
      useCase.execute(new CreateAccountCommand('Wallet', 'AT99', 'user-1')),
    ).rejects.toThrow(ValidationException);
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects the old label "Banco" — codes and labels are not interchangeable', async () => {
    countByUserId.mockResolvedValue(0);

    await expect(
      useCase.execute(new CreateAccountCommand('Wallet', 'Banco', 'user-1')),
    ).rejects.toThrow(ValidationException);
    expect(save).not.toHaveBeenCalled();
  });

  describe('creditLimitCents', () => {
    it('requires creditLimitCents when creating an AT03 (Crédito) account', async () => {
      countByUserId.mockResolvedValue(0);

      await expect(
        useCase.execute(
          new CreateAccountCommand('Credit Card', 'AT03', 'user-1'),
        ),
      ).rejects.toThrow(ValidationException);
      expect(save).not.toHaveBeenCalled();
    });

    it('accepts an AT03 account when creditLimitCents is provided', async () => {
      countByUserId.mockResolvedValue(0);
      let savedEntity: AccountEntity | undefined;
      save.mockImplementation((entity: AccountEntity) => {
        savedEntity = entity;
        return Promise.resolve(
          new AccountEntity({
            id: 'acc-1',
            name: entity.name,
            type: entity.type,
            userId: entity.userId,
            isActive: entity.isActive,
            isPrincipal: entity.isPrincipal,
            creditLimitCents: entity.creditLimitCents,
          }),
        );
      });

      const result = await useCase.execute(
        new CreateAccountCommand('Credit Card', 'AT03', 'user-1', 50000000),
      );

      expect(savedEntity?.creditLimitCents).toBe(50000000);
      expect(result).toEqual({ id: 'acc-1' });
    });

    it('rejects creditLimitCents for a non-AT03 type', async () => {
      countByUserId.mockResolvedValue(0);

      await expect(
        useCase.execute(
          new CreateAccountCommand('Checking', 'AT02', 'user-1', 50000),
        ),
      ).rejects.toThrow(ValidationException);
      expect(save).not.toHaveBeenCalled();
    });
  });
});
