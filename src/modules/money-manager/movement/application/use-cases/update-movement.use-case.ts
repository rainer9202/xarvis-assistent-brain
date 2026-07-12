import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  NotFoundException,
  ValidationException,
} from '@domain/exceptions/domain.exception';
import { MOVEMENT_TYPE_CODES } from '@domain/enums/movement-type.enum';
import type { MovementTypeCode } from '@domain/enums/movement-type.enum';
import { GetAccountByIdUseCase } from '@modules/money-manager/account/application/use-cases/get-account-by-id.use-case';
import { GetCategoryByIdUseCase } from '@modules/money-manager/category/application/use-cases/get-category-by-id.use-case';
import { GetGroupByIdUseCase } from '@modules/money-manager/group/application/use-cases/get-group-by-id.use-case';
import { MOVEMENT_REPOSITORY } from '../../domain/ports/movement.repository.port';
import type { MovementRepositoryPort } from '../../domain/ports/movement.repository.port';
import {
  assertWithinCreditLimit,
  sourceAccountEffectCents,
} from '../shared/credit-limit';

// Local, duplicated per file — mirrors the EXPENSE_TYPE_NAME pattern in
// PrismaAccountRepository rather than a shared cross-module enum file.
const TRANSFER_TYPE_NAME = 'MT03';

export type UpdateMovementResponse = {
  id: string;
};

export class UpdateMovementCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly amountCents?: number,
    public readonly date?: Date,
    public readonly note?: string,
    public readonly accountId?: string,
    public readonly categoryId?: string,
    public readonly movementType?: string,
    public readonly toAccountId?: string,
    public readonly groupId?: string | null,
  ) {}
}

@Injectable()
export class UpdateMovementUseCase {
  constructor(
    @Inject(MOVEMENT_REPOSITORY)
    private readonly repository: MovementRepositoryPort,
    private readonly getAccountById: GetAccountByIdUseCase,
    private readonly getCategoryById: GetCategoryByIdUseCase,
    private readonly getGroupById: GetGroupByIdUseCase,
  ) {}

  async execute(
    command: UpdateMovementCommand,
  ): Promise<UpdateMovementResponse> {
    try {
      const movement = await this.repository.findById(
        command.id,
        command.userId,
      );
      if (!movement)
        throw new NotFoundException(`Movement "${command.id}" not found`);

      const originalAccountId = movement.accountId;
      const originalMovementType = movement.movementType;
      const originalAmountCents = movement.amountCents;

      const touchesTransferFields =
        command.movementType !== undefined ||
        command.toAccountId !== undefined ||
        command.accountId !== undefined;

      let targetAccount:
        | Awaited<ReturnType<typeof this.getAccountById.execute>>
        | undefined;

      if (command.accountId !== undefined) {
        targetAccount = await this.getAccountById.execute(
          command.accountId,
          command.userId,
        );
        movement.accountId = command.accountId;
      }
      if (command.categoryId !== undefined) {
        await this.getCategoryById.execute(command.categoryId, command.userId);
        movement.categoryId = command.categoryId;
      }
      if (command.groupId !== undefined) {
        if (command.groupId !== null)
          await this.getGroupById.execute(command.groupId, command.userId);
        movement.groupId = command.groupId ?? undefined;
      }
      if (command.movementType !== undefined) {
        if (
          !MOVEMENT_TYPE_CODES.includes(
            command.movementType as MovementTypeCode,
          )
        )
          throw new ValidationException(
            `Movement type "${command.movementType}" is invalid. Must be one of: ${MOVEMENT_TYPE_CODES.join(', ')}`,
          );
        movement.movementType = command.movementType;
      }

      if (touchesTransferFields) {
        const effectiveToAccountId =
          command.toAccountId !== undefined
            ? command.toAccountId
            : movement.toAccountId;

        if (movement.movementType === TRANSFER_TYPE_NAME) {
          if (!effectiveToAccountId)
            throw new ValidationException(
              'Transfer movements require a toAccountId',
            );
          if (effectiveToAccountId === movement.accountId)
            throw new ValidationException(
              'Cannot transfer to the same account',
            );
          await this.getAccountById.execute(
            effectiveToAccountId,
            command.userId,
          );
        } else if (effectiveToAccountId) {
          throw new ValidationException(
            'toAccountId is only allowed for transfer movements',
          );
        }
      }

      if (command.toAccountId !== undefined)
        movement.toAccountId = command.toAccountId;
      if (command.amountCents !== undefined)
        movement.amountCents = command.amountCents;
      if (command.date !== undefined) movement.date = command.date;
      if (command.note !== undefined) movement.note = command.note;

      const touchesBalanceFields =
        command.amountCents !== undefined ||
        command.movementType !== undefined ||
        command.accountId !== undefined;

      if (touchesBalanceFields) {
        const oldEffect = sourceAccountEffectCents(
          originalMovementType,
          originalAmountCents,
        );
        const newEffect = sourceAccountEffectCents(
          movement.movementType,
          movement.amountCents,
        );

        if (movement.accountId === originalAccountId) {
          const netDelta = newEffect - oldEffect;
          if (netDelta < 0) {
            const account =
              targetAccount ??
              (await this.getAccountById.execute(
                movement.accountId,
                command.userId,
              ));
            assertWithinCreditLimit(account, netDelta);
          }
        } else {
          // Removing the movement's old contribution from the account it's
          // leaving: if that contribution was positive (income), the old
          // account's balance drops by oldEffect, which can newly breach
          // ITS limit if it's also a Crédito account. Removing a
          // debt-increasing (expense/transfer-out) contribution only ever
          // moves balance toward zero, so it never needs checking.
          if (oldEffect > 0) {
            const oldAccount = await this.getAccountById.execute(
              originalAccountId,
              command.userId,
            );
            assertWithinCreditLimit(oldAccount, -oldEffect);
          }
          // Adding the movement's new contribution to the account it's
          // moving to — only a debt-increasing effect can breach its limit.
          if (newEffect < 0) {
            // targetAccount is guaranteed defined here — accountId changed,
            // so the command.accountId !== undefined branch above already
            // fetched it.
            assertWithinCreditLimit(targetAccount!, newEffect);
          }
        }
      }

      const saved = await this.repository.update(movement);

      return { id: saved.id! };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error updating movement: ${error}`);
    }
  }
}
