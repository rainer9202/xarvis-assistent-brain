import {
  NotFoundException,
  ValidationException,
} from '@domain/exceptions/domain.exception';
import { MovementEntity } from '../../domain/entities/movement.entity';
import type { MovementRepositoryPort } from '../../domain/ports/movement.repository.port';
import type { GetAccountByIdUseCase } from '@modules/money-manager/account/application/use-cases/get-account-by-id.use-case';
import type { GetCategoryByIdUseCase } from '@modules/money-manager/category/application/use-cases/get-category-by-id.use-case';
import type { GetGroupByIdUseCase } from '@modules/money-manager/group/application/use-cases/get-group-by-id.use-case';
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
  let getGroupByIdExecute: jest.Mock;
  let getGroupById: GetGroupByIdUseCase;
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
      count: jest.fn(),
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
    getGroupByIdExecute = jest.fn();
    getGroupById = {
      execute: getGroupByIdExecute,
    } as unknown as GetGroupByIdUseCase;
    useCase = new UpdateMovementUseCase(
      repository,
      getAccountById,
      getCategoryById,
      getGroupById,
    );
  });

  it('applies only the provided fields, leaving the rest unchanged', async () => {
    findById.mockResolvedValue(existing());
    // amountCents rises from 1500 to 2000 on the same non-Crédito account —
    // this makes the movement's own effect more negative (netDelta < 0), so
    // UpdateMovementUseCase must re-fetch the account to run the credit-limit
    // check. It's a plain AT02 account, so assertWithinCreditLimit is a no-op.
    getAccountByIdExecute.mockResolvedValue({
      id: 'acc-1',
      name: 'Main Checking',
      type: 'AT02',
      isActive: true,
    });
    update.mockImplementation((entity: MovementEntity) =>
      Promise.resolve(entity),
    );

    const result = await useCase.execute(
      new UpdateMovementCommand('mov-1', 'user-1', 2000),
    );

    expect(findById).toHaveBeenCalledWith('mov-1', 'user-1');
    expect(getAccountByIdExecute).toHaveBeenCalledWith('acc-1', 'user-1');
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

  it('validates and sets a new groupId', async () => {
    findById.mockResolvedValue(existing());
    getGroupByIdExecute.mockResolvedValue({
      id: 'grp-1',
      name: 'Fixed Expenses',
      isActive: true,
    });
    let savedEntity: MovementEntity | undefined;
    update.mockImplementation((entity: MovementEntity) => {
      savedEntity = entity;
      return Promise.resolve(entity);
    });

    const result = await useCase.execute(
      new UpdateMovementCommand(
        'mov-1',
        'user-1',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'grp-1',
      ),
    );

    expect(getGroupByIdExecute).toHaveBeenCalledWith('grp-1', 'user-1');
    expect(savedEntity?.groupId).toBe('grp-1');
    expect(result).toEqual({ id: 'mov-1' });
  });

  it('clears an existing groupId when sent explicit null, without validating', async () => {
    const movement = existing();
    movement.groupId = 'grp-1';
    findById.mockResolvedValue(movement);
    let savedEntity: MovementEntity | undefined;
    update.mockImplementation((entity: MovementEntity) => {
      savedEntity = entity;
      return Promise.resolve(entity);
    });

    await useCase.execute(
      new UpdateMovementCommand(
        'mov-1',
        'user-1',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        null,
      ),
    );

    expect(getGroupByIdExecute).not.toHaveBeenCalled();
    expect(savedEntity?.groupId).toBeUndefined();
  });

  it('rejects a groupId that does not exist or belong to the user', async () => {
    findById.mockResolvedValue(existing());
    getGroupByIdExecute.mockRejectedValue(
      new NotFoundException('Group "grp-missing" not found'),
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
          undefined,
          undefined,
          undefined,
          'grp-missing',
        ),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(update).not.toHaveBeenCalled();
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

  describe('credit limit enforcement', () => {
    const creditAccount = (overrides: Record<string, unknown> = {}) => ({
      id: 'acc-1',
      name: 'Credit Card',
      type: 'AT03',
      creditLimitCents: 50000,
      balanceCents: -20000,
      isActive: true,
      ...overrides,
    });

    beforeEach(() => {
      update.mockImplementation((entity: MovementEntity) =>
        Promise.resolve(entity),
      );
    });

    it('rejects a same-account amount increase that would breach the limit', async () => {
      // existing() is a 1500-cent MT01 expense on acc-1. The account's
      // balanceCents (-20000) already reflects that original -1500 effect.
      // Bumping the amount to 40000 makes the new effect -40000, a net
      // delta of -38500, which would push the projected balance to -58500,
      // beyond the -50000 limit.
      findById.mockResolvedValue(existing());
      getAccountByIdExecute.mockResolvedValue(creditAccount());

      await expect(
        useCase.execute(new UpdateMovementCommand('mov-1', 'user-1', 40000)),
      ).rejects.toThrow(ValidationException);
      expect(update).not.toHaveBeenCalled();
    });

    it('allows a same-account amount decrease that frees up room, without needing a fetch to fail', async () => {
      findById.mockResolvedValue(existing());
      getAccountByIdExecute.mockResolvedValue(creditAccount());

      const result = await useCase.execute(
        new UpdateMovementCommand('mov-1', 'user-1', 500),
      );

      expect(result).toEqual({ id: 'mov-1' });
    });

    it('allows switching a Crédito account movement to income, which always frees up room', async () => {
      findById.mockResolvedValue(existing());
      getAccountByIdExecute.mockResolvedValue(creditAccount());

      const result = await useCase.execute(
        new UpdateMovementCommand(
          'mov-1',
          'user-1',
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          'MT02',
        ),
      );

      expect(result).toEqual({ id: 'mov-1' });
    });

    it('checks the new account limit against the full new amount when moving a movement TO a Crédito account', async () => {
      findById.mockResolvedValue(existing());
      getAccountByIdExecute.mockResolvedValue(
        creditAccount({ id: 'acc-2', balanceCents: -49000 }),
      );

      await expect(
        useCase.execute(
          new UpdateMovementCommand(
            'mov-1',
            'user-1',
            undefined,
            undefined,
            undefined,
            'acc-2',
          ),
        ),
      ).rejects.toThrow(ValidationException);
      expect(update).not.toHaveBeenCalled();
    });

    it('is never blocked by the old account limit when moving a movement AWAY FROM a Crédito account', async () => {
      const movement = new MovementEntity({
        id: 'mov-1',
        amountCents: 1000000,
        date,
        accountId: 'acc-1',
        categoryId: 'cat-1',
        movementType: 'MT01',
        userId: 'user-1',
      });
      findById.mockResolvedValue(movement);
      getAccountByIdExecute.mockResolvedValue({
        id: 'acc-2',
        name: 'Checking',
        type: 'AT02',
        balanceCents: 0,
        isActive: true,
      });

      const result = await useCase.execute(
        new UpdateMovementCommand(
          'mov-1',
          'user-1',
          undefined,
          undefined,
          undefined,
          'acc-2',
        ),
      );

      expect(result).toEqual({ id: 'mov-1' });
    });

    it("rejects moving an income movement AWAY from a Crédito account when removing it would breach that account's own limit", async () => {
      // The income movement being moved away is currently what's keeping
      // acc-1 (limit 50000) afloat: acc-1's fetched balanceCents (-49000)
      // already reflects this movement's +1000 contribution. Removing it
      // drops acc-1 to -50000... but here the move is a bigger amount, so
      // removal pushes it past the limit.
      const movement = new MovementEntity({
        id: 'mov-1',
        amountCents: 5000,
        date,
        accountId: 'acc-1',
        categoryId: 'cat-1',
        movementType: 'MT02',
        userId: 'user-1',
      });
      findById.mockResolvedValue(movement);
      getAccountByIdExecute.mockImplementation((id: string) => {
        if (id === 'acc-1')
          return Promise.resolve(
            creditAccount({ id: 'acc-1', balanceCents: -49000 }),
          );
        return Promise.resolve({
          id: 'acc-2',
          name: 'Checking',
          type: 'AT02',
          balanceCents: 0,
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
            'acc-2',
          ),
        ),
      ).rejects.toThrow(ValidationException);
      expect(update).not.toHaveBeenCalled();
    });
  });
});
