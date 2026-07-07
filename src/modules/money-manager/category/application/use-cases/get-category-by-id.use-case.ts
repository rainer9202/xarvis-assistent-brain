import { Inject, Injectable } from '@nestjs/common';
import {
  DomainException,
  NotFoundException,
} from '@shared/exceptions/domain.exception';
import { CATEGORY_REPOSITORY } from '../../domain/ports/category.repository.port';
import type { CategoryRepositoryPort } from '../../domain/ports/category.repository.port';

export type GetCategoryByIdResponse = {
  id: string;
  name: string;
  movementTypeId: string;
  isActive: boolean;
};

@Injectable()
export class GetCategoryByIdUseCase {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly repository: CategoryRepositoryPort,
  ) {}

  async execute(id: string, userId: string): Promise<GetCategoryByIdResponse> {
    try {
      const category = await this.repository.findById(id, userId);
      if (!category) throw new NotFoundException(`Category "${id}" not found`);

      return {
        id: category.id!,
        name: category.name,
        movementTypeId: category.movementTypeId,
        isActive: category.isActive!,
      };
    } catch (error) {
      if (error instanceof DomainException) throw error;
      throw new Error(`Unexpected error fetching category: ${error}`);
    }
  }
}
