import {
  NotFoundException,
  ValidationException,
} from '@domain/exceptions/domain.exception';
import { MovementEntity } from '../../domain/entities/movement.entity';
import type { MovementRepositoryPort } from '../../domain/ports/movement.repository.port';
import type { GetAccountByIdUseCase } from '@modules/money-manager/account/application/use-cases/get-account-by-id.use-case';
import type { GetCategoryByIdUseCase } from '@modules/money-manager/category/application/use-cases/get-category-by-id.use-case';
import {
  CreateMovementCommand,
  CreateMovementUseCase,
} from './create-movement.use-case';

describe('CreateMovementUseCase', () => {
  let save: jest.Mock;
  let repository: MovementRepositoryPort;
  let getAccountByIdExecute: jest.Mock;
  let getAccountById: GetAccountByIdUseCase;
  let getCategoryByIdExecute: jest.Mock;
  let getCategoryById: GetCategoryByIdUseCase;
  let useCase: CreateMovementUseCase;

  const date = new Date('2024-01-01T00:00:00Z');

  beforeEach(() => {
    save = jest.fn();
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      save,
      update: jest.fn(),
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
    useCase = new CreateMovementUseCase(
      repository,
      getAccountById,
      getCategoryById,
    );
  });

  it('validates account and category existence then creates the movement', async () => {
    getAccountByIdExecute.mockResolvedValue({
      id: 'acc-1',
      name: 'Main Checking',
      type: 'AT02',
      isActive: true,
    });
    getCategoryByIdExecute.mockResolvedValue({
      id: 'cat-1',
      name: 'Groceries',
      movementType: 'Gasto',
      isActive: true,
    });
    let savedEntity: MovementEntity | undefined;
    save.mockImplementation((entity: MovementEntity) => {
      savedEntity = entity;
      return Promise.resolve(
        new MovementEntity({
          id: 'mov-1',
          amountCents: entity.amountCents,
          date: entity.date,
          note: entity.note,
          accountId: entity.accountId,
          categoryId: entity.categoryId,
          movementType: entity.movementType,
          userId: entity.userId,
        }),
      );
    });

    const result = await useCase.execute(
      new CreateMovementCommand(
        1500,
        date,
        'Weekly groceries',
        'acc-1',
        'cat-1',
        'Gasto',
        'user-1',
      ),
    );

    expect(getAccountByIdExecute).toHaveBeenCalledWith('acc-1', 'user-1');
    expect(getCategoryByIdExecute).toHaveBeenCalledWith('cat-1', 'user-1');
    expect(save).toHaveBeenCalledWith(expect.any(MovementEntity));
    expect(savedEntity?.amountCents).toBe(1500);
    expect(savedEntity?.note).toBe('Weekly groceries');
    expect(result).toEqual({ id: 'mov-1' });
  });

  it('throws ValidationException when the movement type is invalid', async () => {
    await expect(
      useCase.execute(
        new CreateMovementCommand(
          1500,
          date,
          undefined,
          'acc-1',
          'cat-1',
          'Invalid',
          'user-1',
        ),
      ),
    ).rejects.toThrow(ValidationException);
    expect(save).not.toHaveBeenCalled();
    expect(getAccountByIdExecute).not.toHaveBeenCalled();
  });

  it('propagates NotFoundException when the account does not exist and does not save', async () => {
    getAccountByIdExecute.mockRejectedValue(
      new NotFoundException('Account "missing" not found'),
    );

    await expect(
      useCase.execute(
        new CreateMovementCommand(
          1500,
          date,
          undefined,
          'missing',
          'cat-1',
          'Gasto',
          'user-1',
        ),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(save).not.toHaveBeenCalled();
  });

  it('propagates NotFoundException when the category does not exist and does not save', async () => {
    getAccountByIdExecute.mockResolvedValue({
      id: 'acc-1',
      name: 'Main Checking',
      type: 'AT02',
      isActive: true,
    });
    getCategoryByIdExecute.mockRejectedValue(
      new NotFoundException('Category "missing" not found'),
    );

    await expect(
      useCase.execute(
        new CreateMovementCommand(
          1500,
          date,
          undefined,
          'acc-1',
          'missing',
          'Gasto',
          'user-1',
        ),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(save).not.toHaveBeenCalled();
  });

  describe('transfer movements', () => {
    beforeEach(() => {
      getAccountByIdExecute.mockImplementation((id: string) =>
        Promise.resolve({
          id,
          name: 'Some account',
          type: 'AT02',
          isActive: true,
        }),
      );
      getCategoryByIdExecute.mockResolvedValue({
        id: 'cat-1',
        name: 'Transfers',
        movementType: 'Transferencia',
        isActive: true,
      });
      save.mockImplementation((entity: MovementEntity) =>
        Promise.resolve(
          new MovementEntity({
            id: 'mov-1',
            amountCents: entity.amountCents,
            date: entity.date,
            note: entity.note,
            accountId: entity.accountId,
            toAccountId: entity.toAccountId,
            categoryId: entity.categoryId,
            movementType: entity.movementType,
            userId: entity.userId,
          }),
        ),
      );
    });

    it('creates a transfer with a valid toAccountId', async () => {
      let savedEntity: MovementEntity | undefined;
      save.mockImplementation((entity: MovementEntity) => {
        savedEntity = entity;
        return Promise.resolve(
          new MovementEntity({
            id: 'mov-1',
            amountCents: entity.amountCents,
            date: entity.date,
            note: entity.note,
            accountId: entity.accountId,
            toAccountId: entity.toAccountId,
            categoryId: entity.categoryId,
            movementType: entity.movementType,
            userId: entity.userId,
          }),
        );
      });

      const result = await useCase.execute(
        new CreateMovementCommand(
          20000,
          date,
          'Transfer to savings',
          'acc-1',
          'cat-1',
          'Transferencia',
          'user-1',
          'acc-2',
        ),
      );

      expect(savedEntity?.toAccountId).toBe('acc-2');
      expect(result).toEqual({ id: 'mov-1' });
    });

    it('throws ValidationException when a transfer has no toAccountId', async () => {
      await expect(
        useCase.execute(
          new CreateMovementCommand(
            20000,
            date,
            undefined,
            'acc-1',
            'cat-1',
            'Transferencia',
            'user-1',
          ),
        ),
      ).rejects.toThrow(ValidationException);
      expect(save).not.toHaveBeenCalled();
    });

    it('throws ValidationException when toAccountId equals accountId', async () => {
      await expect(
        useCase.execute(
          new CreateMovementCommand(
            20000,
            date,
            undefined,
            'acc-1',
            'cat-1',
            'Transferencia',
            'user-1',
            'acc-1',
          ),
        ),
      ).rejects.toThrow(ValidationException);
      expect(save).not.toHaveBeenCalled();
    });

    it('propagates NotFoundException when toAccountId does not exist', async () => {
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
          new CreateMovementCommand(
            20000,
            date,
            undefined,
            'acc-1',
            'cat-1',
            'Transferencia',
            'user-1',
            'missing',
          ),
        ),
      ).rejects.toThrow(NotFoundException);
      expect(save).not.toHaveBeenCalled();
    });

    it('throws ValidationException when a non-transfer movement provides a toAccountId', async () => {
      await expect(
        useCase.execute(
          new CreateMovementCommand(
            1500,
            date,
            undefined,
            'acc-1',
            'cat-1',
            'Gasto',
            'user-1',
            'acc-2',
          ),
        ),
      ).rejects.toThrow(ValidationException);
      expect(save).not.toHaveBeenCalled();
    });
  });
});
