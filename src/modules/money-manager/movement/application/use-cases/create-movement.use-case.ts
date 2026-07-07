import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  ValidationException,
} from '@shared/exceptions/domain.exception';
import { GetAccountByIdUseCase } from '@modules/money-manager/account/application/use-cases/get-account-by-id.use-case';
import { GetCategoryByIdUseCase } from '@modules/money-manager/category/application/use-cases/get-category-by-id.use-case';
import { GetMovementTypeByIdUseCase } from '@modules/money-manager/movement-type/application/use-cases/get-movement-type-by-id.use-case';
import { MovementEntity } from '../../domain/entities/movement.entity';
import { MOVEMENT_REPOSITORY } from '../../domain/ports/movement.repository.port';
import type { MovementRepositoryPort } from '../../domain/ports/movement.repository.port';

// Local, duplicated per file — mirrors the EXPENSE_TYPE_NAME pattern in
// PrismaAccountRepository rather than a shared cross-module enum file.
const TRANSFER_TYPE_NAME = 'transfer';

export type CreateMovementResponse = {
  id: string;
};

export class CreateMovementCommand {
  constructor(
    public readonly amountCents: number,
    public readonly date: Date,
    public readonly note: string | undefined,
    public readonly accountId: string,
    public readonly categoryId: string,
    public readonly movementTypeId: string,
    public readonly userId: string,
    public readonly toAccountId?: string,
  ) {}
}

@Injectable()
export class CreateMovementUseCase {
  constructor(
    @Inject(MOVEMENT_REPOSITORY)
    private readonly repository: MovementRepositoryPort,
    private readonly getAccountById: GetAccountByIdUseCase,
    private readonly getCategoryById: GetCategoryByIdUseCase,
    private readonly getMovementTypeById: GetMovementTypeByIdUseCase,
  ) {}

  async execute(
    command: CreateMovementCommand,
  ): Promise<CreateMovementResponse> {
    try {
      await this.getAccountById.execute(command.accountId, command.userId);
      await this.getCategoryById.execute(command.categoryId, command.userId);
      const movementType = await this.getMovementTypeById.execute(
        command.movementTypeId,
      );

      if (movementType.name === TRANSFER_TYPE_NAME) {
        if (!command.toAccountId)
          throw new ValidationException(
            'Transfer movements require a toAccountId',
          );
        if (command.toAccountId === command.accountId)
          throw new ValidationException('Cannot transfer to the same account');
        await this.getAccountById.execute(command.toAccountId, command.userId);
      } else if (command.toAccountId) {
        throw new ValidationException(
          'toAccountId is only allowed for transfer movements',
        );
      }

      const entity = new MovementEntity({
        amountCents: command.amountCents,
        date: command.date,
        note: command.note,
        accountId: command.accountId,
        toAccountId: command.toAccountId,
        categoryId: command.categoryId,
        movementTypeId: command.movementTypeId,
        userId: command.userId,
      });
      const saved = await this.repository.save(entity);

      return { id: saved.id! };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error creating movement: ${error}`);
    }
  }
}
