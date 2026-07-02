import { ValidationException } from '@shared/exceptions/domain.exception';
import { NotFoundException } from '@shared/exceptions/domain.exception';
import { AccountEntity } from '../../domain/entities/account.entity';
import type { AccountRepositoryPort } from '../../domain/ports/account.repository.port';
import {
  DeleteAccountCommand,
  DeleteAccountUseCase,
} from './delete-account.use-case';

describe('DeleteAccountUseCase', () => {
  let findById: jest.Mock;
  let update: jest.Mock;
  let countMovementsByAccountId: jest.Mock;
  let repository: AccountRepositoryPort;
  let useCase: DeleteAccountUseCase;

  beforeEach(() => {
    findById = jest.fn();
    update = jest.fn();
    countMovementsByAccountId = jest.fn();
    repository = {
      findAll: jest.fn(),
      findById,
      save: jest.fn(),
      update,
      countMovementsByAccountId,
      findAllWithBalance: jest.fn(),
    };
    useCase = new DeleteAccountUseCase(repository);
  });

  it('sets isActive to false when there are zero referencing movements', async () => {
    const entity = new AccountEntity({
      id: 'acc-1',
      name: 'Main Checking',
      type: 'bank',
      isActive: true,
    });
    findById.mockResolvedValue(entity);
    countMovementsByAccountId.mockResolvedValue(0);
    update.mockImplementation((account: AccountEntity) =>
      Promise.resolve(account),
    );

    const result = await useCase.execute(new DeleteAccountCommand('acc-1'));

    expect(countMovementsByAccountId).toHaveBeenCalledWith('acc-1');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: false }),
    );
    expect(result).toEqual({ id: 'acc-1', isActive: false });
  });

  it('throws ValidationException and keeps isActive true when referenced by a movement', async () => {
    const entity = new AccountEntity({
      id: 'acc-1',
      name: 'Main Checking',
      type: 'bank',
      isActive: true,
    });
    findById.mockResolvedValue(entity);
    countMovementsByAccountId.mockResolvedValue(2);

    await expect(
      useCase.execute(new DeleteAccountCommand('acc-1')),
    ).rejects.toThrow(ValidationException);
    expect(update).not.toHaveBeenCalled();
    expect(entity.isActive).toBe(true);
  });

  it('throws NotFoundException when the account does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(
      useCase.execute(new DeleteAccountCommand('missing')),
    ).rejects.toThrow(NotFoundException);
    expect(countMovementsByAccountId).not.toHaveBeenCalled();
  });
});
