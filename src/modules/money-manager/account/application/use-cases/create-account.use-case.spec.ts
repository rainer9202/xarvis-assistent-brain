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
      new CreateAccountCommand('Main Checking', 'bank', 'user-1'),
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
      new CreateAccountCommand('Main Checking', 'bank', 'user-1'),
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
      new CreateAccountCommand('Savings', 'bank', 'user-1'),
    );

    expect(savedEntity?.isPrincipal).toBe(false);
  });

  it('throws ValidationException when type is not cash/bank/card', async () => {
    countByUserId.mockResolvedValue(0);

    await expect(
      useCase.execute(new CreateAccountCommand('Wallet', 'crypto', 'user-1')),
    ).rejects.toThrow(ValidationException);
    expect(save).not.toHaveBeenCalled();
  });
});
