import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  NotFoundException,
} from '@domain/exceptions/domain.exception';
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
  movementType: string;
  createdAt: Date;
};

@Injectable()
export class GetMovementByIdUseCase {
  constructor(
    @Inject(MOVEMENT_REPOSITORY)
    private readonly repository: MovementRepositoryPort,
  ) {}

  async execute(id: string, userId: string): Promise<GetMovementByIdResponse> {
    try {
      const movement = await this.repository.findById(id, userId);
      if (!movement) throw new NotFoundException(`Movement "${id}" not found`);

      return {
        id: movement.id!,
        amountCents: movement.amountCents,
        date: movement.date,
        note: movement.note,
        accountId: movement.accountId,
        toAccountId: movement.toAccountId,
        categoryId: movement.categoryId,
        movementType: movement.movementType,
        createdAt: movement.createdAt!,
      };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error fetching movement: ${error}`);
    }
  }
}
