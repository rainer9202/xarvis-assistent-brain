import { ValidationException } from '@domain/exceptions/domain.exception';
import { NotFoundException } from '@domain/exceptions/domain.exception';
import { AccountEntity } from '../../domain/entities/account.entity';
import type { AccountRepositoryPort } from '../../domain/ports/account.repository.port';
import {
  DeleteAccountCommand,
  DeleteAccountUseCase,
} from './delete-account.use-case';

describe('DeleteAccountUseCase', () => {
  let findById: jest.Mock;
  let deleteFn: jest.Mock;
  let countMovementsByAccountId: jest.Mock;
  let repository: AccountRepositoryPort;
  let useCase: DeleteAccountUseCase;

  beforeEach(() => {
    findById = jest.fn();
    deleteFn = jest.fn();
    countMovementsByAccountId = jest.fn();
    repository = {
      findAll: jest.fn(),
      findById,
      save: jest.fn(),
      update: jest.fn(),
      delete: deleteFn,
      countMovementsByAccountId,
      findAllWithBalance: jest.fn(),
      findByIdWithBalance: jest.fn(),
      countByUserId: jest.fn(),
      setPrincipal: jest.fn(),
    };
    useCase = new DeleteAccountUseCase(repository);
  });

  it('deletes the account when there are zero referencing movements', async () => {
    const entity = new AccountEntity({
      id: 'acc-1',
      name: 'Main Checking',
      type: 'AT02',
      userId: 'user-1',
      isActive: true,
    });
    findById.mockResolvedValue(entity);
    countMovementsByAccountId.mockResolvedValue(0);
    deleteFn.mockResolvedValue(undefined);

    const result = await useCase.execute(
      new DeleteAccountCommand('acc-1', 'user-1'),
    );

    expect(countMovementsByAccountId).toHaveBeenCalledWith('acc-1');
    expect(deleteFn).toHaveBeenCalledWith(entity);
    expect(result).toEqual({ id: 'acc-1' });
  });

  it('throws ValidationException and does not delete when referenced by a movement', async () => {
    const entity = new AccountEntity({
      id: 'acc-1',
      name: 'Main Checking',
      type: 'AT02',
      userId: 'user-1',
      isActive: true,
    });
    findById.mockResolvedValue(entity);
    countMovementsByAccountId.mockResolvedValue(2);

    await expect(
      useCase.execute(new DeleteAccountCommand('acc-1', 'user-1')),
    ).rejects.toThrow(ValidationException);
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the account does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(
      useCase.execute(new DeleteAccountCommand('missing', 'user-1')),
    ).rejects.toThrow(NotFoundException);
    expect(countMovementsByAccountId).not.toHaveBeenCalled();
  });

  it('throws ValidationException and does not delete the principal account, even with zero referencing movements', async () => {
    const entity = new AccountEntity({
      id: 'acc-1',
      name: 'Main Checking',
      type: 'AT02',
      userId: 'user-1',
      isActive: true,
      isPrincipal: true,
    });
    findById.mockResolvedValue(entity);

    await expect(
      useCase.execute(new DeleteAccountCommand('acc-1', 'user-1')),
    ).rejects.toThrow(ValidationException);
    expect(countMovementsByAccountId).not.toHaveBeenCalled();
    expect(deleteFn).not.toHaveBeenCalled();
  });
});
