import { Inject, Injectable } from '@nestjs/common';
import { DomainException } from '@domain/exceptions/domain.exception';
import { MOVEMENT_REPOSITORY } from '../../domain/ports/movement.repository.port';
import type { MovementRepositoryPort } from '../../domain/ports/movement.repository.port';

export type GetAllMovementsResponse = {
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
export class GetAllMovementsUseCase {
  constructor(
    @Inject(MOVEMENT_REPOSITORY)
    private readonly repository: MovementRepositoryPort,
  ) {}

  async execute(
    userId: string,
    accountId?: string,
  ): Promise<GetAllMovementsResponse[]> {
    try {
      const entities = await this.repository.findAll(userId, accountId);
      return entities.map((item) => ({
        id: item.id!,
        amountCents: item.amountCents,
        date: item.date,
        note: item.note,
        accountId: item.accountId,
        toAccountId: item.toAccountId,
        categoryId: item.categoryId,
        movementType: item.movementType,
        createdAt: item.createdAt!,
      }));
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error fetching movements: ${error}`);
    }
  }
}
