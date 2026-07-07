import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  NotFoundException,
  ValidationException,
} from '@shared/exceptions/domain.exception';
import { GetAccountByIdUseCase } from '@modules/money-manager/account/application/use-cases/get-account-by-id.use-case';
import { GetCategoryByIdUseCase } from '@modules/money-manager/category/application/use-cases/get-category-by-id.use-case';
import { GetMovementTypeByIdUseCase } from '@modules/money-manager/movement-type/application/use-cases/get-movement-type-by-id.use-case';
import type { GetMovementTypeByIdResponse } from '@modules/money-manager/movement-type/application/use-cases/get-movement-type-by-id.use-case';
import { MOVEMENT_REPOSITORY } from '../../domain/ports/movement.repository.port';
import type { MovementRepositoryPort } from '../../domain/ports/movement.repository.port';

// Local, duplicated per file — mirrors the EXPENSE_TYPE_NAME pattern in
// PrismaAccountRepository rather than a shared cross-module enum file.
const TRANSFER_TYPE_NAME = 'transfer';

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
    public readonly movementTypeId?: string,
    public readonly toAccountId?: string,
  ) {}
}

@Injectable()
export class UpdateMovementUseCase {
  constructor(
    @Inject(MOVEMENT_REPOSITORY)
    private readonly repository: MovementRepositoryPort,
    private readonly getAccountById: GetAccountByIdUseCase,
    private readonly getCategoryById: GetCategoryByIdUseCase,
    private readonly getMovementTypeById: GetMovementTypeByIdUseCase,
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

      const touchesTransferFields =
        command.movementTypeId !== undefined ||
        command.toAccountId !== undefined ||
        command.accountId !== undefined;

      if (command.accountId !== undefined) {
        await this.getAccountById.execute(command.accountId, command.userId);
        movement.accountId = command.accountId;
      }
      if (command.categoryId !== undefined) {
        await this.getCategoryById.execute(command.categoryId, command.userId);
        movement.categoryId = command.categoryId;
      }
      let movementType: GetMovementTypeByIdResponse | undefined;
      if (command.movementTypeId !== undefined) {
        movementType = await this.getMovementTypeById.execute(
          command.movementTypeId,
        );
        movement.movementTypeId = command.movementTypeId;
      }

      if (touchesTransferFields) {
        const effectiveToAccountId =
          command.toAccountId !== undefined
            ? command.toAccountId
            : movement.toAccountId;
        if (!movementType) {
          movementType = await this.getMovementTypeById.execute(
            movement.movementTypeId,
          );
        }

        if (movementType.name === TRANSFER_TYPE_NAME) {
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

      const saved = await this.repository.update(movement);

      return { id: saved.id! };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error updating movement: ${error}`);
    }
  }
}
