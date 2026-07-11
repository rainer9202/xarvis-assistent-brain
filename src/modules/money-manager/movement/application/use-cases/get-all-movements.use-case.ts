import { Inject, Injectable } from '@nestjs/common';
import { DomainException } from '@domain/exceptions/domain.exception';
import { getMovementTypeLabel } from '@domain/enums/movement-type.enum';
import { GetAllCategoriesUseCase } from '@modules/money-manager/category/application/use-cases/get-all-categories.use-case';
import { MOVEMENT_REPOSITORY } from '../../domain/ports/movement.repository.port';
import type {
  MovementFilters,
  MovementRepositoryPort,
} from '../../domain/ports/movement.repository.port';

export type GetAllMovementsResponse = {
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
  createdAt: Date;
};

@Injectable()
export class GetAllMovementsUseCase {
  constructor(
    @Inject(MOVEMENT_REPOSITORY)
    private readonly repository: MovementRepositoryPort,
    private readonly getAllCategories: GetAllCategoriesUseCase,
  ) {}

  async execute(
    userId: string,
    filters?: MovementFilters,
  ): Promise<GetAllMovementsResponse[]> {
    try {
      // Fetched once per call (not per movement) to avoid an N+1 query —
      // Category is real per-user data, not a static enum, so there's no
      // getCategoryLabel()-style pure-function lookup like movementType has.
      const [entities, categories] = await Promise.all([
        this.repository.findAll(userId, filters),
        this.getAllCategories.execute(userId),
      ]);
      const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

      return entities.map((item) => ({
        id: item.id!,
        amountCents: item.amountCents,
        date: item.date,
        note: item.note,
        accountId: item.accountId,
        toAccountId: item.toAccountId,
        categoryId: item.categoryId,
        categoryLabel: categoryNameById.get(item.categoryId) ?? item.categoryId,
        movementType: item.movementType,
        movementTypeLabel:
          getMovementTypeLabel(item.movementType) ?? item.movementType,
        createdAt: item.createdAt!,
      }));
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error fetching movements: ${error}`);
    }
  }
}
