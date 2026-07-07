import { Inject, Injectable } from '@nestjs/common';
import { DomainException } from '@shared/exceptions/domain.exception';
import { CATEGORY_REPOSITORY } from '../../domain/ports/category.repository.port';
import type { CategoryRepositoryPort } from '../../domain/ports/category.repository.port';

export type GetAllCategoriesResponse = {
  id: string;
  name: string;
  movementTypeId: string;
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
        movementTypeId: item.movementTypeId,
        isActive: item.isActive!,
        createdAt: item.createdAt!,
      }));
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error fetching categories: ${error}`);
    }
  }
}
