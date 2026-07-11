import {
  NotFoundException,
  ValidationException,
} from '@domain/exceptions/domain.exception';
import { AccountEntity } from '../../domain/entities/account.entity';
import type { AccountRepositoryPort } from '../../domain/ports/account.repository.port';
import {
  UpdateAccountCommand,
  UpdateAccountUseCase,
} from './update-account.use-case';

describe('UpdateAccountUseCase', () => {
  let findById: jest.Mock;
  let update: jest.Mock;
  let setPrincipal: jest.Mock;
  let repository: AccountRepositoryPort;
  let useCase: UpdateAccountUseCase;

  beforeEach(() => {
    findById = jest.fn();
    update = jest.fn();
    setPrincipal = jest.fn();
    repository = {
      findAll: jest.fn(),
      findById,
      save: jest.fn(),
      update,
      countMovementsByAccountId: jest.fn(),
      findAllWithBalance: jest.fn(),
      findByIdWithBalance: jest.fn(),
      countByUserId: jest.fn(),
      setPrincipal,
    };
    useCase = new UpdateAccountUseCase(repository);
  });

  it('applies only the provided fields, leaving the rest unchanged', async () => {
    const existing = new AccountEntity({
      id: 'acc-1',
      name: 'Main Checking',
      type: 'AT02',
      userId: 'user-1',
      isActive: true,
    });
    findById.mockResolvedValue(existing);
    update.mockImplementation((entity: AccountEntity) =>
      Promise.resolve(entity),
    );

    const result = await useCase.execute(
      new UpdateAccountCommand('acc-1', 'user-1', 'Savings'),
    );

    expect(findById).toHaveBeenCalledWith('acc-1', 'user-1');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Savings',
        type: 'AT02',
        isActive: true,
      }),
    );
    expect(result).toEqual({ id: 'acc-1' });
  });

  it('throws NotFoundException when the account does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(
      useCase.execute(new UpdateAccountCommand('missing', 'user-1', 'Savings')),
    ).rejects.toThrow(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });

  it('throws ValidationException when type is not AT01/AT02/AT03', async () => {
    const existing = new AccountEntity({
      id: 'acc-1',
      name: 'Main Checking',
      type: 'AT02',
      userId: 'user-1',
      isActive: true,
    });
    findById.mockResolvedValue(existing);

    await expect(
      useCase.execute(
        new UpdateAccountCommand('acc-1', 'user-1', undefined, 'crypto'),
      ),
    ).rejects.toThrow(ValidationException);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects the old label "Banco" — codes and labels are not interchangeable', async () => {
    const existing = new AccountEntity({
      id: 'acc-1',
      name: 'Main Checking',
      type: 'AT02',
      userId: 'user-1',
      isActive: true,
    });
    findById.mockResolvedValue(existing);

    await expect(
      useCase.execute(
        new UpdateAccountCommand('acc-1', 'user-1', undefined, 'Banco'),
      ),
    ).rejects.toThrow(ValidationException);
    expect(update).not.toHaveBeenCalled();
  });

  it('atomically swaps the principal account via repository.setPrincipal', async () => {
    const existing = new AccountEntity({
      id: 'acc-2',
      name: 'Savings',
      type: 'AT02',
      userId: 'user-1',
      isActive: true,
      isPrincipal: false,
    });
    findById.mockResolvedValue(existing);
    update.mockImplementation((entity: AccountEntity) =>
      Promise.resolve(entity),
    );
    setPrincipal.mockResolvedValue(undefined);

    const result = await useCase.execute(
      new UpdateAccountCommand(
        'acc-2',
        'user-1',
        undefined,
        undefined,
        undefined,
        true,
      ),
    );

    expect(setPrincipal).toHaveBeenCalledWith('acc-2', 'user-1');
    expect(result).toEqual({ id: 'acc-2' });
  });

  it('throws ValidationException when isPrincipal is explicitly set to false', async () => {
    const existing = new AccountEntity({
      id: 'acc-1',
      name: 'Main Checking',
      type: 'AT02',
      userId: 'user-1',
      isActive: true,
      isPrincipal: true,
    });
    findById.mockResolvedValue(existing);

    await expect(
      useCase.execute(
        new UpdateAccountCommand(
          'acc-1',
          'user-1',
          undefined,
          undefined,
          undefined,
          false,
        ),
      ),
    ).rejects.toThrow(ValidationException);
    expect(update).not.toHaveBeenCalled();
    expect(setPrincipal).not.toHaveBeenCalled();
  });

  it('does not call setPrincipal when isPrincipal is not provided', async () => {
    const existing = new AccountEntity({
      id: 'acc-1',
      name: 'Main Checking',
      type: 'AT02',
      userId: 'user-1',
      isActive: true,
      isPrincipal: true,
    });
    findById.mockResolvedValue(existing);
    update.mockImplementation((entity: AccountEntity) =>
      Promise.resolve(entity),
    );

    await useCase.execute(
      new UpdateAccountCommand('acc-1', 'user-1', 'Renamed'),
    );

    expect(setPrincipal).not.toHaveBeenCalled();
  });
});
