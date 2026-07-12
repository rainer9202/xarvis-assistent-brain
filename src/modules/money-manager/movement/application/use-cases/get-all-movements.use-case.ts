import { Inject, Injectable } from '@nestjs/common';
import { DomainException } from '@domain/exceptions/domain.exception';
import { getMovementTypeLabel } from '@domain/enums/movement-type.enum';
import { GetAllCategoriesUseCase } from '@modules/money-manager/category/application/use-cases/get-all-categories.use-case';
import { GetAllGroupsUseCase } from '@modules/money-manager/group/application/use-cases/get-all-groups.use-case';
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
  groupId?: string;
  groupLabel?: string;
  createdAt: Date;
};

export type GetAllMovementsResult = {
  items: GetAllMovementsResponse[];
  pagination?: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasMore: boolean;
  };
};

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

@Injectable()
export class GetAllMovementsUseCase {
  constructor(
    @Inject(MOVEMENT_REPOSITORY)
    private readonly repository: MovementRepositoryPort,
    private readonly getAllCategories: GetAllCategoriesUseCase,
    private readonly getAllGroups: GetAllGroupsUseCase,
  ) {}

  async execute(
    userId: string,
    filters?: MovementFilters,
  ): Promise<GetAllMovementsResult> {
    try {
      const isPaginated =
        filters?.page !== undefined || filters?.limit !== undefined;
      // Resolved once here so the use case and the repository agree on the
      // same effective page/limit — the repository receives the already
      // -resolved values via the filters object instead of re-defaulting
      // independently.
      const effectivePage = filters?.page ?? DEFAULT_PAGE;
      const effectiveLimit = filters?.limit ?? DEFAULT_LIMIT;
      const resolvedFilters = isPaginated
        ? { ...filters, page: effectivePage, limit: effectiveLimit }
        : filters;

      // Fetched once per call (not per movement) to avoid an N+1 query —
      // Category/Group are real per-user data, not a static enum, so
      // there's no getXLabel()-style pure-function lookup like movementType
      // has.
      const [entities, categories, groups, totalCount] = await Promise.all([
        this.repository.findAll(userId, resolvedFilters),
        this.getAllCategories.execute(userId),
        this.getAllGroups.execute(userId),
        isPaginated
          ? this.repository.count(userId, resolvedFilters)
          : Promise.resolve(undefined),
      ]);
      const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
      const groupNameById = new Map(groups.map((g) => [g.id, g.name]));

      const items = entities.map((item) => ({
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
        groupId: item.groupId,
        groupLabel: item.groupId
          ? (groupNameById.get(item.groupId) ?? item.groupId)
          : undefined,
        createdAt: item.createdAt!,
      }));

      if (!isPaginated || totalCount === undefined) {
        return { items };
      }

      return {
        items,
        pagination: {
          page: effectivePage,
          limit: effectiveLimit,
          totalCount,
          totalPages: Math.ceil(totalCount / effectiveLimit),
          hasMore: effectivePage * effectiveLimit < totalCount,
        },
      };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error fetching movements: ${error}`);
    }
  }
}
