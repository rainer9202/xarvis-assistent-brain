import { NotFoundException } from '@shared/exceptions/domain.exception';
import { AccountEntity } from '../../domain/entities/account.entity';
import type { AccountRepositoryPort } from '../../domain/ports/account.repository.port';
import {
  UpdateAccountCommand,
  UpdateAccountUseCase,
} from './update-account.use-case';

describe('UpdateAccountUseCase', () => {
  let findById: jest.Mock;
  let update: jest.Mock;
  let repository: AccountRepositoryPort;
  let useCase: UpdateAccountUseCase;

  beforeEach(() => {
    findById = jest.fn();
    update = jest.fn();
    repository = {
      findAll: jest.fn(),
      findById,
      save: jest.fn(),
      update,
      countMovementsByAccountId: jest.fn(),
      findAllWithBalance: jest.fn(),
    };
    useCase = new UpdateAccountUseCase(repository);
  });

  it('applies only the provided fields, leaving the rest unchanged', async () => {
    const existing = new AccountEntity({
      id: 'acc-1',
      name: 'Main Checking',
      type: 'bank',
      isActive: true,
    });
    findById.mockResolvedValue(existing);
    update.mockImplementation((entity: AccountEntity) =>
      Promise.resolve(entity),
    );

    const result = await useCase.execute(
      new UpdateAccountCommand('acc-1', 'Savings'),
    );

    expect(findById).toHaveBeenCalledWith('acc-1');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Savings',
        type: 'bank',
        isActive: true,
      }),
    );
    expect(result).toEqual({
      id: 'acc-1',
      name: 'Savings',
      type: 'bank',
      isActive: true,
    });
  });

  it('throws NotFoundException when the account does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(
      useCase.execute(new UpdateAccountCommand('missing', 'Savings')),
    ).rejects.toThrow(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });
});
