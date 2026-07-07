import { ValidationException } from '@shared/exceptions/domain.exception';
import { AccountEntity } from '../../domain/entities/account.entity';
import type { AccountRepositoryPort } from '../../domain/ports/account.repository.port';
import {
  CreateAccountCommand,
  CreateAccountUseCase,
} from './create-account.use-case';

describe('CreateAccountUseCase', () => {
  let save: jest.Mock;
  let repository: AccountRepositoryPort;
  let useCase: CreateAccountUseCase;

  beforeEach(() => {
    save = jest.fn();
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      save,
      update: jest.fn(),
      countMovementsByAccountId: jest.fn(),
      findAllWithBalance: jest.fn(),
      findByIdWithBalance: jest.fn(),
    };
    useCase = new CreateAccountUseCase(repository);
  });

  it('creates an account defaulting isActive to true', async () => {
    let savedEntity: AccountEntity | undefined;
    save.mockImplementation((entity: AccountEntity) => {
      savedEntity = entity;
      return Promise.resolve(
        new AccountEntity({
          id: 'acc-1',
          name: entity.name,
          type: entity.type,
          isActive: entity.isActive,
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

  it('throws ValidationException when type is not cash/bank/card', async () => {
    await expect(
      useCase.execute(new CreateAccountCommand('Wallet', 'crypto', 'user-1')),
    ).rejects.toThrow(ValidationException);
    expect(save).not.toHaveBeenCalled();
  });
});
