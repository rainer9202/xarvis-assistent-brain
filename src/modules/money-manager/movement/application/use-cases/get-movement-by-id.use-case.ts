import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  NotFoundException,
} from '@domain/exceptions/domain.exception';
import { getMovementTypeLabel } from '@domain/enums/movement-type.enum';
import { GetCategoryByIdUseCase } from '@modules/money-manager/category/application/use-cases/get-category-by-id.use-case';
import { GetGroupByIdUseCase } from '@modules/money-manager/group/application/use-cases/get-group-by-id.use-case';
import { MOVEMENT_REPOSITORY } from '../../domain/ports/movement.repository.port';
import type { MovementRepositoryPort } from '../../domain/ports/movement.repository.port';

export type GetMovementByIdResponse = {
  id: string;
  amountCents: number;
  date: Date;
  note?: string;
  accountId: string;
  toAccountId?: string;
  categoryId: string;
  categoryLabel: string;
  movementType: string;
  movementTypeLabel: string;
  groupId?: string;
  groupLabel?: string;
  createdAt: Date;
};

@Injectable()
export class GetMovementByIdUseCase {
  constructor(
    @Inject(MOVEMENT_REPOSITORY)
    private readonly repository: MovementRepositoryPort,
    private readonly getCategoryById: GetCategoryByIdUseCase,
    private readonly getGroupById: GetGroupByIdUseCase,
  ) {}

  async execute(id: string, userId: string): Promise<GetMovementByIdResponse> {
    try {
      const movement = await this.repository.findById(id, userId);
      if (!movement) throw new NotFoundException(`Movement "${id}" not found`);

      const category = await this.getCategoryById.execute(
        movement.categoryId,
        userId,
      );
      const group = movement.groupId
        ? await this.getGroupById.execute(movement.groupId, userId)
        : undefined;

      return {
        id: movement.id!,
        amountCents: movement.amountCents,
        date: movement.date,
        note: movement.note,
        accountId: movement.accountId,
        toAccountId: movement.toAccountId,
        categoryId: movement.categoryId,
        categoryLabel: category.name,
        movementType: movement.movementType,
        movementTypeLabel:
          getMovementTypeLabel(movement.movementType) ?? movement.movementType,
        groupId: movement.groupId,
        groupLabel: group?.name,
        createdAt: movement.createdAt!,
      };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error fetching movement: ${error}`);
    }
  }
}
