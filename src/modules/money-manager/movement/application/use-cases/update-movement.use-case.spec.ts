import {
  NotFoundException,
  ValidationException,
} from '@domain/exceptions/domain.exception';
import { MovementEntity } from '../../domain/entities/movement.entity';
import type { MovementRepositoryPort } from '../../domain/ports/movement.repository.port';
import type { GetAccountByIdUseCase } from '@modules/money-manager/account/application/use-cases/get-account-by-id.use-case';
import type { GetCategoryByIdUseCase } from '@modules/money-manager/category/application/use-cases/get-category-by-id.use-case';
import {
  UpdateMovementCommand,
  UpdateMovementUseCase,
} from './update-movement.use-case';

describe('UpdateMovementUseCase', () => {
  let findById: jest.Mock;
  let update: jest.Mock;
  let repository: MovementRepositoryPort;
  let getAccountByIdExecute: jest.Mock;
  let getAccountById: GetAccountByIdUseCase;
  let getCategoryByIdExecute: jest.Mock;
  let getCategoryById: GetCategoryByIdUseCase;
  let useCase: UpdateMovementUseCase;

  const date = new Date('2024-01-01T00:00:00Z');

  const existing = () =>
    new MovementEntity({
      id: 'mov-1',
      amountCents: 1500,
      date,
      note: 'Weekly groceries',
      accountId: 'acc-1',
      categoryId: 'cat-1',
      movementType: 'MT01',
      userId: 'user-1',
    });

  beforeEach(() => {
    findById = jest.fn();
    update = jest.fn();
    repository = {
      findAll: jest.fn(),
      findById,
      save: jest.fn(),
      update,
      delete: jest.fn(),
    };
    getAccountByIdExecute = jest.fn();
    getAccountById = {
      execute: getAccountByIdExecute,
    } as unknown as GetAccountByIdUseCase;
    getCategoryByIdExecute = jest.fn();
    getCategoryById = {
      execute: getCategoryByIdExecute,
    } as unknown as GetCategoryByIdUseCase;
    useCase = new UpdateMovementUseCase(
      repository,
      getAccountById,
      getCategoryById,
    );
  });

  it('applies only the provided fields, leaving the rest unchanged', async () => {
    findById.mockResolvedValue(existing());
    update.mockImplementation((entity: MovementEntity) =>
      Promise.resolve(entity),
    );

    const result = await useCase.execute(
      new UpdateMovementCommand('mov-1', 'user-1', 2000),
    );

    expect(findById).toHaveBeenCalledWith('mov-1', 'user-1');
    expect(getAccountByIdExecute).not.toHaveBeenCalled();
    expect(getCategoryByIdExecute).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 2000,
        note: 'Weekly groceries',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        movementType: 'MT01',
      }),
    );
    expect(result).toEqual({ id: 'mov-1' });
  });

  it('throws NotFoundException when the movement does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(
      useCase.execute(new UpdateMovementCommand('missing', 'user-1', 2000)),
    ).rejects.toThrow(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });

  it('re-validates the account when accountId is provided, propagating NotFoundException', async () => {
    findById.mockResolvedValue(existing());
    getAccountByIdExecute.mockRejectedValue(
      new NotFoundException('Account "missing" not found'),
    );

    await expect(
      useCase.execute(
        new UpdateMovementCommand(
          'mov-1',
          'user-1',
          undefined,
          undefined,
          undefined,
          'missing',
        ),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });

  it('re-validates the category when categoryId is provided, propagating NotFoundException', async () => {
    findById.mockResolvedValue(existing());
    getCategoryByIdExecute.mockRejectedValue(
      new NotFoundException('Category "missing" not found'),
    );

    await expect(
      useCase.execute(
        new UpdateMovementCommand(
          'mov-1',
          'user-1',
          undefined,
          undefined,
          undefined,
          undefined,
          'missing',
        ),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });

  it('throws ValidationException when movementType is invalid', async () => {
    findById.mockResolvedValue(existing());

    await expect(
      useCase.execute(
        new UpdateMovementCommand(
          'mov-1',
          'user-1',
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          'Invalid',
        ),
      ),
    ).rejects.toThrow(ValidationException);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects the old label as an invalid movement type code', async () => {
    findById.mockResolvedValue(existing());

    await expect(
      useCase.execute(
        new UpdateMovementCommand(
          'mov-1',
          'user-1',
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          'Gasto',
        ),
      ),
    ).rejects.toThrow(ValidationException);
    expect(update).not.toHaveBeenCalled();
  });

  it('applies accountId, categoryId, and movementType after successful re-validation', async () => {
    findById.mockResolvedValue(existing());
    getAccountByIdExecute.mockResolvedValue({
      id: 'acc-2',
      name: 'Savings',
      type: 'AT02',
      isActive: true,
    });
    getCategoryByIdExecute.mockResolvedValue({
      id: 'cat-2',
      name: 'Rent',
      movementType: 'MT02',
      isActive: true,
    });
    update.mockImplementation((entity: MovementEntity) =>
      Promise.resolve(entity),
    );

    const result = await useCase.execute(
      new UpdateMovementCommand(
        'mov-1',
        'user-1',
        undefined,
        undefined,
        undefined,
        'acc-2',
        'cat-2',
        'MT02',
      ),
    );

    expect(getAccountByIdExecute).toHaveBeenCalledWith('acc-2', 'user-1');
    expect(getCategoryByIdExecute).toHaveBeenCalledWith('cat-2', 'user-1');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'acc-2',
        categoryId: 'cat-2',
        movementType: 'MT02',
      }),
    );
    expect(result).toEqual({ id: 'mov-1' });
  });

  describe('transfer movements', () => {
    const existingTransfer = () =>
      new MovementEntity({
        id: 'mov-1',
        amountCents: 20000,
        date,
        accountId: 'acc-1',
        toAccountId: 'acc-2',
        categoryId: 'cat-1',
        movementType: 'MT03',
        userId: 'user-1',
      });

    beforeEach(() => {
      getAccountByIdExecute.mockImplementation((id: string) =>
        Promise.resolve({
          id,
          name: 'Some account',
          type: 'AT02',
          isActive: true,
        }),
      );
      update.mockImplementation((entity: MovementEntity) =>
        Promise.resolve(entity),
      );
    });

    it('updates a transfer with a valid toAccountId', async () => {
      findById.mockResolvedValue(existing());

      const result = await useCase.execute(
        new UpdateMovementCommand(
          'mov-1',
          'user-1',
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          'MT03',
          'acc-2',
        ),
      );

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ toAccountId: 'acc-2' }),
      );
      expect(result).toEqual({ id: 'mov-1' });
    });

    it('throws ValidationException when switching to transfer without a toAccountId', async () => {
      findById.mockResolvedValue(existing());

      await expect(
        useCase.execute(
          new UpdateMovementCommand(
            'mov-1',
            'user-1',
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            'MT03',
          ),
        ),
      ).rejects.toThrow(ValidationException);
      expect(update).not.toHaveBeenCalled();
    });

    it('throws ValidationException when toAccountId equals the effective accountId', async () => {
      findById.mockResolvedValue(existingTransfer());

      await expect(
        useCase.execute(
          new UpdateMovementCommand(
            'mov-1',
            'user-1',
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            'acc-1',
          ),
        ),
      ).rejects.toThrow(ValidationException);
      expect(update).not.toHaveBeenCalled();
    });

    it('propagates NotFoundException when the new toAccountId does not exist', async () => {
      findById.mockResolvedValue(existingTransfer());
      getAccountByIdExecute.mockImplementation((id: string) => {
        if (id === 'missing')
          return Promise.reject(
            new NotFoundException('Account "missing" not found'),
          );
        return Promise.resolve({
          id,
          name: 'Some account',
          type: 'AT02',
          isActive: true,
        });
      });

      await expect(
        useCase.execute(
          new UpdateMovementCommand(
            'mov-1',
            'user-1',
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            'missing',
          ),
        ),
      ).rejects.toThrow(NotFoundException);
      expect(update).not.toHaveBeenCalled();
    });

    it('throws ValidationException when providing a toAccountId for a non-transfer movement', async () => {
      findById.mockResolvedValue(existing());

      await expect(
        useCase.execute(
          new UpdateMovementCommand(
            'mov-1',
            'user-1',
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            'acc-2',
          ),
        ),
      ).rejects.toThrow(ValidationException);
      expect(update).not.toHaveBeenCalled();
    });
  });
});
