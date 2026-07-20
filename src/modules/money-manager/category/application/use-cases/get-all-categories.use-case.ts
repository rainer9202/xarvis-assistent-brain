import { Inject, Injectable } from '@nestjs/common';
import { DomainException } from '@domain/exceptions/domain.exception';
import { getMovementTypeLabel } from '@domain/enums/movement-type.enum';
import { CATEGORY_REPOSITORY } from '../../domain/ports/category.repository.port';
import type { CategoryRepositoryPort } from '../../domain/ports/category.repository.port';

export type GetAllCategoriesResponse = {
  id: string;
  name: string;
  icon: string;
  movementType: string;
  movementTypeLabel: string;
  isActive: boolean;
  createdAt: Date;
};

@Injectable()
export class GetAllCategoriesUseCase {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly repository: CategoryRepositoryPort,
  ) {}

  async execute(userId: string): Promise<GetAllCategoriesResponse[]> {
    try {
      const entities = await this.repository.findAll(userId);
      return entities.map((item) => ({
        id: item.id!,
        name: item.name,
        icon: item.icon,
        movementType: item.movementType,
        movementTypeLabel:
          getMovementTypeLabel(item.movementType) ?? item.movementType,
        isActive: item.isActive!,
        createdAt: item.createdAt!,
      }));
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error fetching categories: ${error}`);
    }
  }
}
